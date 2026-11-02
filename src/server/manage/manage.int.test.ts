import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => import('@/test/pglite-db'));

import { eq } from 'drizzle-orm';
import { payments, registrationEntries, tournaments } from '@/db/schema';
import { confirmWeighIn, findByTicket, getCheckinDetail, moveEntry } from '@/server/checkin/service';
import { addExpense, getFinance, getPublicFinance, setFinanceVisibility } from '@/server/finance/service';
import { getLatestBanner, postponeTournament } from '@/server/notifications/service';
import { rotateWebhookSecret } from '@/server/organizations/webhook-secret';
import { handleSepayWebhook } from '@/server/payments/sepay';
import { register } from '@/server/registration/service';
import { athleteInput, NOW, publishedTournament } from '@/test/fixtures';
import { createUser, db, resetDb } from '@/test/pglite-db';
import {
  cancelRegistration,
  getDashboardStats,
  listRegistrations,
  listUnmatchedPayments,
  matchPayment,
  recordPayment,
  setRegistrationStatus,
} from './registrations';

beforeEach(resetDb);
const online = { source: 'online' as const, now: NOW };

describe('BTC quản lý đăng ký', () => {
  it('lọc, tìm kiếm, duyệt, thống kê', async () => {
    const f = await publishedTournament();
    const a = await register(f.tournament.id, athleteInput({ categoryIds: [f.r63, f.l63] }), online);
    await register(f.tournament.id, athleteInput({ fullName: 'Trần Đức Anh', phone: '0987654321', birthYear: 2010, categoryIds: [f.r63] }), online);

    expect(await listRegistrations(f.user.id, f.tournament.id)).toHaveLength(2);
    expect(await listRegistrations(f.user.id, f.tournament.id, 'age_warning')).toHaveLength(1);
    expect((await listRegistrations(f.user.id, f.tournament.id, 'all', 'duc anh'))[0]!.athlete.fullName).toBe('Trần Đức Anh');
    expect(await listRegistrations(f.user.id, f.tournament.id, 'all', '0987')).toHaveLength(1);
    expect((await listRegistrations(f.user.id, f.tournament.id, 'all', a.registration.code))[0]!.entries).toHaveLength(2);

    await setRegistrationStatus(f.user.id, a.registration.id, 'approved');
    expect(await listRegistrations(f.user.id, f.tournament.id, 'pending')).toHaveLength(1);

    await recordPayment(f.user.id, a.registration.id, { amount: 250000, method: 'cash' });
    const s = await getDashboardStats(f.user.id, f.tournament.id);
    expect(s).toMatchObject({ athletes: 2, pending: 1, unpaid: 1, ageWarning: 1, entries: 3, due: 400000, paid: 250000 });

    await cancelRegistration(f.user.id, a.registration.id);
    expect(await listRegistrations(f.user.id, f.tournament.id)).toHaveLength(1);
  });

  it('người ngoài không xem được danh sách', async () => {
    const f = await publishedTournament();
    const other = await createUser('khac@vidu.com');
    await expect(listRegistrations(other.id, f.tournament.id)).rejects.toThrow('không có quyền');
  });

  it('ghép tay giao dịch chưa khớp', async () => {
    const f = await publishedTournament();
    const key = await rotateWebhookSecret(f.user.id, f.org.id);
    const { registration } = await register(f.tournament.id, athleteInput({ categoryIds: [f.r63] }), online);
    await handleSepayWebhook(f.org.id, `Apikey ${key}`, {
      id: 1, transactionDate: '2026-12-01 10:00:00', accountNumber: '0123456789', content: 'dang ky khang', transferType: 'in', transferAmount: 150000,
    });
    const [p] = await listUnmatchedPayments(f.user.id, f.tournament.id);
    await matchPayment(f.user.id, p!.id, registration.id);
    expect(await listUnmatchedPayments(f.user.id, f.tournament.id)).toHaveLength(0);
    const [row] = await listRegistrations(f.user.id, f.tournament.id);
    expect(row!.paymentStatus).toBe('paid');
    await expect(matchPayment(f.user.id, p!.id, registration.id)).rejects.toThrow('không còn chờ ghép');
    expect((await db.select().from(payments))[0]!.matchStatus).toBe('matched');
  });
});

describe('check-in & cân', () => {
  it('quét vé, cân vượt → gợi ý không đạt, chuyển hạng', async () => {
    const f = await publishedTournament();
    // thêm hạng -73 tay phải để có chỗ chuyển
    const { saveCategories, getTournamentForEdit } = await import('@/server/tournaments/service');
    const before = await getTournamentForEdit(f.user.id, f.tournament.id);
    await saveCategories(f.user.id, f.tournament.id, {
      categories: [
        ...before.categories.map((c) => ({ ...c, key: c.id, allAroundSourceKeys: [] })),
        { key: 'r73', kind: 'weight', hand: 'right', gender: 'male', label: '-73kg', weightMaxKg: 73 },
      ],
    });
    const r73 = (await getTournamentForEdit(f.user.id, f.tournament.id)).categories.find((c) => c.label === '-73kg')!.id;

    const { registration } = await register(f.tournament.id, athleteInput({ categoryIds: [f.r63, f.l63] }), online);
    const found = await findByTicket(f.user.id, f.tournament.id, `https://vattay.vn/ve/${registration.ticketToken}`);
    expect(found).toBe(registration.id);

    const vs = await confirmWeighIn(f.user.id, f.tournament.id, registration.id, '64,6');
    expect(vs.every((v) => !v.pass)).toBe(true);
    const right = vs.find((v) => v.suggestion?.id === r73);
    expect(right).toBeTruthy();

    const detail = await getCheckinDetail(f.user.id, f.tournament.id, registration.id);
    expect(detail.registration.weighedKg).toBe(64.6);
    expect(detail.registration.checkedInAt).not.toBeNull();

    const entry = detail.entries.find((e) => e.category.hand === 'right')!;
    await moveEntry(f.user.id, f.tournament.id, entry.id, r73);
    await expect(moveEntry(f.user.id, f.tournament.id, entry.id, r73)).rejects.toThrow('không còn hiệu lực');
    await expect(
      moveEntry(f.user.id, f.tournament.id, detail.entries.find((e) => e.category.hand === 'left')!.id, r73),
    ).rejects.toThrow('cùng tay');
    const after = await getCheckinDetail(f.user.id, f.tournament.id, registration.id);
    expect(after.entries.map((e) => e.category.label).sort()).toEqual(['-63kg', '-73kg']);
    const moved = await db.select().from(registrationEntries).where(eq(registrationEntries.status, 'moved'));
    expect(moved).toHaveLength(1);
  });
});

describe('dời lịch, thông báo, thu chi', () => {
  it('dời lịch đổi giờ, dời hạn đăng ký, tạo banner và văn bản Zalo', async () => {
    const f = await publishedTournament();
    const r = await postponeTournament(f.user.id, f.tournament.id, { startsAt: '2026-12-22T07:00', message: 'Do sân bận' });
    expect(r.zaloText).toContain('22.12.2026');
    const t = await db.query.tournaments.findFirst({ where: eq(tournaments.id, f.tournament.id) });
    expect(t!.startsAt!.toISOString()).toBe('2026-12-22T00:00:00.000Z');
    expect(t!.registrationDeadline!.toISOString()).toBe('2026-12-19T16:59:00.000Z');
    expect((await getLatestBanner(f.tournament.id))!.body).toContain('Do sân bận');
  });

  it('thu chi: thu từ tiền đã ghép, ẩn với công chúng mặc định', async () => {
    const f = await publishedTournament();
    const { registration } = await register(f.tournament.id, athleteInput({ categoryIds: [f.r63] }), online);
    await recordPayment(f.user.id, registration.id, { amount: 150000, method: 'cash' });
    await addExpense(f.user.id, f.tournament.id, { title: 'Thuê bàn', amount: '100.000' });
    const fin = await getFinance(f.user.id, f.tournament.id);
    expect(fin).toMatchObject({ visibility: 'off', totalIncome: 150000, totalExpense: 100000, balance: 50000 });
    expect(await getPublicFinance(f.tournament.id, true)).toBeNull();
    await setFinanceVisibility(f.user.id, f.tournament.id, 'athletes');
    expect(await getPublicFinance(f.tournament.id, false)).toBeNull();
    expect((await getPublicFinance(f.tournament.id, true))!.balance).toBe(50000);
  });
});
