import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => import('@/test/pglite-db'));

import { eq } from 'drizzle-orm';
import { auditLogs, payments, registrationEntries } from '@/db/schema';
import { rotateWebhookSecret } from '@/server/organizations/webhook-secret';
import { handleSepayWebhook } from '@/server/payments/sepay';
import { athleteInput, NOW, publishedTournament } from '@/test/fixtures';
import { db, resetDb } from '@/test/pglite-db';
import { getTicket, register } from './service';

beforeEach(resetDb);
const online = { source: 'online' as const, now: NOW };

describe('đăng ký', () => {
  it('2 tay online được combo 250k, mã và mã CK hợp lệ', async () => {
    const f = await publishedTournament();
    const { registration: r, created } = await register(f.tournament.id, athleteInput({ categoryIds: [f.r63, f.l63] }), online);
    expect(created).toBe(true);
    expect(r.amountDue).toBe(250000);
    expect(r.paymentStatus).toBe('unpaid');
    expect(r.code).toMatch(/^[A-Z]{2}\d{2}-0001$/);
    expect(r.transferRef).toMatch(/^VT[A-Z2-9]{6}$/);
    const entries = await db.select().from(registrationEntries).where(eq(registrationEntries.registrationId, r.id));
    expect(entries.map((e) => e.fee).sort()).toEqual([100000, 150000]);
  });

  it('đăng ký thêm cập nhật bản cũ: online tay phải rồi tại sân tay trái = +170k', async () => {
    const f = await publishedTournament();
    const first = await register(f.tournament.id, athleteInput({ categoryIds: [f.r63] }), online);
    const second = await register(f.tournament.id, athleteInput({ fullName: 'Nguyễn Minh Khang', categoryIds: [f.l63] }), { source: 'onsite', now: NOW });
    expect(second.created).toBe(false);
    expect(second.registration.id).toBe(first.registration.id);
    expect(second.registration.amountDue).toBe(320000);
    expect(await db.select().from(auditLogs)).toHaveLength(1);
  });

  it('đăng ký lại cùng hạng không tính thêm tiền', async () => {
    const f = await publishedTournament();
    await register(f.tournament.id, athleteInput({ categoryIds: [f.r63] }), online);
    const again = await register(f.tournament.id, athleteInput({ categoryIds: [f.r63] }), online);
    expect(again.addedCount).toBe(0);
    expect(again.registration.amountDue).toBe(150000);
  });

  it('sai năm sinh chỉ cảnh báo, không chặn', async () => {
    const f = await publishedTournament();
    const { registration } = await register(f.tournament.id, athleteInput({ birthYear: 2010, categoryIds: [f.r63] }), online);
    expect(registration.ageWarning).toBe(true);
  });

  it('nam không đăng ký được hạng nữ', async () => {
    const f = await publishedTournament();
    await expect(register(f.tournament.id, athleteInput({ categoryIds: [f.f55] }), online)).rejects.toThrow('không dành cho');
  });

  it('chặn khi hết hạn đăng ký online', async () => {
    const f = await publishedTournament();
    await expect(register(f.tournament.id, athleteInput({ categoryIds: [f.r63] }), { source: 'online', now: new Date('2026-12-14T00:00:00Z') })).rejects.toThrow(
      'hết hạn',
    );
  });

  it('không vượt số suất của giải', async () => {
    const f = await publishedTournament({ capacity: '1' });
    await register(f.tournament.id, athleteInput({ categoryIds: [f.r63] }), online);
    await expect(register(f.tournament.id, athleteInput({ fullName: 'Trần Đức Anh', phone: '0987654321', categoryIds: [f.r63] }), online)).rejects.toThrow(
      'đủ số suất',
    );
  });

  it('đăng ký đồng thời không vượt suất (khóa dòng giải)', async () => {
    const f = await publishedTournament({ capacity: '2' });
    const people = ['0981000001', '0981000002', '0981000003', '0981000004'].map((phone, i) =>
      register(f.tournament.id, athleteInput({ fullName: `VĐV ${i}`, phone, categoryIds: [f.r63] }), online),
    );
    const results = await Promise.allSettled(people);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
  });

  it('vé hiển thị đúng hạng và thông tin ngân hàng', async () => {
    const f = await publishedTournament();
    const { registration } = await register(f.tournament.id, athleteInput({ categoryIds: [f.r63, f.l63] }), online);
    const ticket = await getTicket(registration.ticketToken);
    expect(ticket!.athlete.fullName).toBe('Nguyễn Minh Khang');
    expect(ticket!.athlete.phone).toBe('+84912345678');
    expect(ticket!.entries).toHaveLength(2);
    expect(ticket!.bank.accountNo).toBe('0123456789');
    expect(await getTicket('khong-ton-tai-khong-ton-tai')).toBeNull();
  });
});

describe('webhook SePay', () => {
  const body = (o: Record<string, unknown>) => ({
    id: 9001, gateway: 'Vietcombank', transactionDate: '2026-12-01 21:14:05', accountNumber: '0123456789',
    content: '', transferType: 'in', transferAmount: 250000, ...o,
  });

  it('sai API key bị từ chối', async () => {
    const f = await publishedTournament();
    await rotateWebhookSecret(f.user.id, f.org.id);
    expect((await handleSepayWebhook(f.org.id, 'Apikey sai', body({}))).status).toBe('unauthorized');
  });

  it('khớp mã CK → Đã đóng; gửi lại không ghi trùng', async () => {
    const f = await publishedTournament();
    const key = await rotateWebhookSecret(f.user.id, f.org.id);
    const { registration } = await register(f.tournament.id, athleteInput({ categoryIds: [f.r63, f.l63] }), online);
    const payload = body({ content: `MBVCB.1234.${registration.transferRef} chuyen tien` });
    const r = await handleSepayWebhook(f.org.id, `Apikey ${key}`, payload);
    expect(r).toMatchObject({ status: 'matched', paymentStatus: 'paid' });
    expect((await handleSepayWebhook(f.org.id, `Apikey ${key}`, payload)).status).toBe('duplicate');
    const ticket = await getTicket(registration.ticketToken);
    expect(ticket!.registration.amountPaid).toBe(250000);
  });

  it('chuyển thiếu → đóng thiếu', async () => {
    const f = await publishedTournament();
    const key = await rotateWebhookSecret(f.user.id, f.org.id);
    const { registration } = await register(f.tournament.id, athleteInput({ categoryIds: [f.r63, f.l63] }), online);
    const r = await handleSepayWebhook(f.org.id, `Apikey ${key}`, body({ content: registration.transferRef, transferAmount: 150000 }));
    expect(r).toMatchObject({ status: 'matched', paymentStatus: 'partial' });
  });

  it('nội dung sai → vào hàng chờ ghép tay', async () => {
    const f = await publishedTournament();
    const key = await rotateWebhookSecret(f.user.id, f.org.id);
    const r = await handleSepayWebhook(f.org.id, `Apikey ${key}`, body({ content: 'chuyen tien dang ky' }));
    expect(r.status).toBe('unmatched');
    const [p] = await db.select().from(payments);
    expect(p).toMatchObject({ matchStatus: 'unmatched', registrationId: null, amount: 250000 });
  });

  it('tiền ra bị bỏ qua', async () => {
    const f = await publishedTournament();
    const key = await rotateWebhookSecret(f.user.id, f.org.id);
    expect((await handleSepayWebhook(f.org.id, `Apikey ${key}`, body({ transferType: 'out' }))).status).toBe('ignored');
  });
});

describe('VĐV đăng nhập để đăng ký', () => {
  it('đăng ký gắn với tài khoản → hiện trong "Vé của tôi"', async () => {
    const { createUser } = await import('@/test/pglite-db');
    const { listMyTickets } = await import('./service');
    const f = await publishedTournament();
    const vdv = await createUser('vdv@vidu.com');
    await register(f.tournament.id, athleteInput({ categoryIds: [f.r63] }), { source: 'online', now: NOW, athleteUserId: vdv.id });
    const mine = await listMyTickets(vdv.id);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ athleteName: 'Nguyễn Minh Khang', slug: 'ptit-2026', amountDue: 150000 });
    expect(await listMyTickets(f.user.id)).toHaveLength(0);
  });
});
