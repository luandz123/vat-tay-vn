import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => import('@/test/pglite-db'));

import { eq } from 'drizzle-orm';
import { athletes, categories, matches, payments, registrations, tournaments } from '@/db/schema';
import { assignTable, createTable, deleteTable, generateBracket, recordResult } from '@/server/brackets/service';
import { confirmWeighIn } from '@/server/checkin/service';
import { recordPayment } from '@/server/manage/registrations';
import { register } from '@/server/registration/service';
import { deleteTournament, deletionImpact, updateInfo } from '@/server/tournaments/service';
import { athleteInput, NOW, publishedTournament } from '@/test/fixtures';
import { createUser, db, resetDb } from '@/test/pglite-db';
import { acceptInvite, createInvite, listMembers, peekInvite, removeMember, revokeInvite } from './members';

beforeEach(resetDb);

describe('thành viên BTC', () => {
  it('mời bằng link → nhân viên quản lý được giải, không sửa được BTC', async () => {
    const f = await publishedTournament();
    const staff = await createUser('nhanvien@vidu.com');
    await expect(updateInfo(staff.id, f.tournament.id, { name: 'X', slug: f.tournament.slug })).rejects.toThrow('không có quyền');

    const { token } = await createInvite(f.user.id, f.org.id, { note: 'Bàn cân' });
    expect((await peekInvite(token))!.state).toBe('valid');
    await acceptInvite(staff.id, token);
    expect((await peekInvite(token))!.state).toBe('used');
    await expect(acceptInvite(staff.id, token)).rejects.toThrow('đã được dùng');

    // nhân viên làm được việc trong giải
    await updateInfo(staff.id, f.tournament.id, { name: 'Giải PTIT 2026 (sửa)', slug: f.tournament.slug, startsAt: '2026-12-15T07:00', venueName: 'NTĐ' });
    // nhưng không tạo link mời / không xóa giải
    await expect(createInvite(staff.id, f.org.id, {})).rejects.toThrow('không có quyền');
    await expect(deleteTournament(staff.id, f.tournament.id, f.tournament.slug)).rejects.toThrow('không có quyền');

    const { members } = await listMembers(f.user.id, f.org.id);
    expect(members.map((m) => m.role).sort()).toEqual(['owner', 'staff']);
    await removeMember(f.user.id, f.org.id, staff.id);
    await expect(updateInfo(staff.id, f.tournament.id, { name: 'Y', slug: f.tournament.slug })).rejects.toThrow('không có quyền');
    await expect(removeMember(f.user.id, f.org.id, f.user.id)).rejects.toThrow('ít nhất một chủ');
  });

  it('link thu hồi hoặc hết hạn thì không dùng được', async () => {
    const f = await publishedTournament();
    const u = await createUser('a@vidu.com');
    const { token, invite } = await createInvite(f.user.id, f.org.id, {});
    await revokeInvite(f.user.id, f.org.id, invite.id);
    await expect(acceptInvite(u.id, token)).rejects.toThrow('thu hồi');
    expect(await peekInvite('khong-ton-tai-khong-ton-tai')).toBeNull();
  });
});

describe('xóa giải', () => {
  it('xóa sạch giải có đăng ký, tiền, bảng đấu, kết quả; giữ hồ sơ VĐV', async () => {
    const f = await publishedTournament();
    for (let i = 0; i < 2; i++) {
      const { registration } = await register(f.tournament.id, athleteInput({ fullName: `VĐV ${i}`, phone: `098100000${i}`, categoryIds: [f.r63] }), { source: 'online', now: NOW });
      await recordPayment(f.user.id, registration.id, { amount: 150000, method: 'cash' });
      await confirmWeighIn(f.user.id, f.tournament.id, registration.id, '60');
    }
    const b = await generateBracket(f.user.id, f.r63, { type: 'double', seed: 1 });
    const [m] = (await db.select().from(matches).where(eq(matches.bracketId, b.id))).filter((x) => x.status === 'ready');
    // Kết quả ghi từ tablet (actor là bàn) → nhật ký trỏ tới bàn
    const table = await createTable(f.user.id, f.tournament.id, 'Bàn 1');
    await assignTable(f.user.id, m!.id, table.id);
    const onTable = (await db.query.matches.findFirst({ where: eq(matches.id, m!.id) }))!;
    await recordResult({ tableId: table.id }, { matchId: m!.id, winnerEntryId: m!.redEntryId, version: onTable.version, clientEventId: randomUUID() });
    // Xóa bàn đã có nhật ký trọng tài không bị khóa ngoại chặn
    const spare = await createTable(f.user.id, f.tournament.id, 'Bàn phụ');
    await deleteTable(f.user.id, spare.id);

    expect(await deletionImpact(f.user.id, f.tournament.id)).toMatchObject({ registrations: 2, paid: 300000 });
    await expect(deleteTournament(f.user.id, f.tournament.id, 'sai-duong-dan')).rejects.toThrow('không khớp');
    const { imageKeys } = await deleteTournament(f.user.id, f.tournament.id, f.tournament.slug);
    expect(imageKeys).toHaveLength(2);

    expect(await db.select().from(tournaments)).toHaveLength(0);
    expect(await db.select().from(categories)).toHaveLength(0);
    expect(await db.select().from(registrations)).toHaveLength(0);
    expect(await db.select().from(payments)).toHaveLength(0);
    expect(await db.select().from(matches)).toHaveLength(0);
    expect(await db.select().from(athletes)).toHaveLength(2);
  });
});
