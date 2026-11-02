import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => import('@/test/pglite-db'));

import { and, eq } from 'drizzle-orm';
import { categoryResults, matches, registrationEntries } from '@/db/schema';
import { confirmWeighIn } from '@/server/checkin/service';
import { register } from '@/server/registration/service';
import { getTournamentForEdit, saveCategories } from '@/server/tournaments/service';
import { athleteInput, NOW, publishedTournament } from '@/test/fixtures';
import { createUser, db, resetDb } from '@/test/pglite-db';
import {
  addMatchEvent,
  assignTable,
  createTable,
  generateBracket,
  getBoard,
  getMatchTallies,
  getTableQueue,
  issueTableCode,
  recordResult,
  swapEntries,
  tableByCode,
  undoResult,
} from './service';

beforeEach(resetDb);

async function setup(n: number, checkIn = true) {
  const f = await publishedTournament();
  for (let i = 0; i < n; i++) {
    const { registration } = await register(
      f.tournament.id,
      athleteInput({ fullName: `Vận Động Viên ${i}`, phone: `09810000${String(i).padStart(2, '0')}`, categoryIds: [f.r63] }),
      { source: 'online', now: NOW },
    );
    if (checkIn) await confirmWeighIn(f.user.id, f.tournament.id, registration.id, '62');
  }
  return f;
}

const ready = async (bracketId: string) =>
  (await db.select().from(matches).where(eq(matches.bracketId, bracketId))).filter((m) => ['ready', 'on_table', 'in_progress'].includes(m.status)).sort((a, b) => a.number - b.number);

describe('bảng đấu (integration)', () => {
  it('cần ít nhất 2 VĐV đã check-in', async () => {
    const f = await setup(3, false);
    await expect(generateBracket(f.user.id, f.r63, { type: 'single' })).rejects.toThrow('đã check-in');
    const b = await generateBracket(f.user.id, f.r63, { type: 'single', onlyCheckedIn: false });
    expect(b.status).toBe('draft');
  });

  it('đấu trọn loại đơn 5 VĐV: bye tự đi tiếp, xếp hạng, trọng tài theo bàn', async () => {
    const f = await setup(5);
    const b = await generateBracket(f.user.id, f.r63, { type: 'single', thirdPlaceMatch: true, seed: 7 });
    const all = await db.select().from(matches).where(eq(matches.bracketId, b.id));
    expect(all).toHaveLength(8); // 4 + 2 + 1 + tranh hạng 3
    expect(all.filter((m) => m.status === 'bye')).toHaveLength(3);

    const table = await createTable(f.user.id, f.tournament.id, 'Bàn 1');
    const code = await issueTableCode(f.user.id, table.id);
    expect((await tableByCode(code))!.id).toBe(table.id);
    const actor = { tableId: table.id };

    let guard = 0;
    while (guard++ < 20) {
      const r = await ready(b.id);
      if (!r.length) break;
      const m = r[0]!;
      await assignTable(f.user.id, m.id, table.id);
      const fresh = (await db.query.matches.findFirst({ where: eq(matches.id, m.id) }))!;
      expect(fresh.status).toBe('on_table');
      const q = await getTableQueue(table.id);
      expect(q.queue.map((x) => x.id)).toContain(m.id);
      await addMatchEvent(actor, { matchId: m.id, type: 'foul', entryId: fresh.redEntryId, clientEventId: randomUUID() });
      const cid = randomUUID();
      await recordResult(actor, { matchId: m.id, winnerEntryId: fresh.redEntryId, version: fresh.version, clientEventId: cid });
      // gửi lại cùng clientEventId → không lỗi, không ghi trùng
      expect((await recordResult(actor, { matchId: m.id, winnerEntryId: fresh.redEntryId, version: fresh.version, clientEventId: cid })).duplicate).toBe(true);
      expect((await getMatchTallies(m.id))[fresh.redEntryId!]!.foul).toBe(1);
    }
    const res = await db.select().from(categoryResults).where(eq(categoryResults.categoryId, f.r63));
    expect(res.map((r) => r.place).sort()).toEqual([1, 2, 3, 4]);
    const board = await getBoard(f.tournament.id);
    expect(board.categories.find((c) => c.category.id === f.r63)!.bracket!.status).toBe('finished');
  });

  it('trọng tài bàn khác không ghi được; version cũ bị từ chối; hoàn tác', async () => {
    const f = await setup(4);
    const b = await generateBracket(f.user.id, f.r63, { type: 'single', seed: 1 });
    const t1 = await createTable(f.user.id, f.tournament.id, 'Bàn 1');
    const t2 = await createTable(f.user.id, f.tournament.id, 'Bàn 2');
    const [m] = await ready(b.id);
    await assignTable(f.user.id, m!.id, t1.id);
    const cur = (await db.query.matches.findFirst({ where: eq(matches.id, m!.id) }))!;
    await expect(recordResult({ tableId: t2.id }, { matchId: cur.id, winnerEntryId: cur.redEntryId, version: cur.version, clientEventId: randomUUID() })).rejects.toThrow(
      'không thuộc bàn',
    );
    await expect(recordResult({ tableId: t1.id }, { matchId: cur.id, winnerEntryId: cur.redEntryId, version: cur.version - 1, clientEventId: randomUUID() })).rejects.toThrow(
      'thiết bị khác',
    );
    await recordResult({ tableId: t1.id }, { matchId: cur.id, winnerEntryId: cur.blueEntryId, version: cur.version, clientEventId: randomUUID() });
    const final = (await db.select().from(matches).where(and(eq(matches.bracketId, b.id), eq(matches.round, 2))))[0]!;
    expect([final.redEntryId, final.blueEntryId]).toContain(cur.blueEntryId);

    await undoResult({ tableId: t1.id }, { matchId: cur.id, clientEventId: randomUUID() });
    const after = (await db.query.matches.findFirst({ where: eq(matches.id, cur.id) }))!;
    expect(after.status).toBe('on_table');
    expect(after.winnerEntryId).toBeNull();
    const final2 = (await db.query.matches.findFirst({ where: eq(matches.id, final.id) }))!;
    expect([final2.redEntryId, final2.blueEntryId]).not.toContain(cur.blueEntryId);
  });

  it('kéo thả đổi vị trí khi còn nháp; bốc lại bị chặn khi đã đấu', async () => {
    const f = await setup(4);
    const b = await generateBracket(f.user.id, f.r63, { type: 'double', seed: 3 });
    const [m1, m2] = (await db.select().from(matches).where(and(eq(matches.bracketId, b.id), eq(matches.side, 'winners'), eq(matches.round, 1)))).sort(
      (a, z) => a.position - z.position,
    );
    await swapEntries(f.user.id, b.id, m1!.redEntryId!, m2!.blueEntryId!);
    const n1 = (await db.query.matches.findFirst({ where: eq(matches.id, m1!.id) }))!;
    expect(n1.redEntryId).toBe(m2!.blueEntryId);

    await recordResult({ userId: f.user.id }, { matchId: n1.id, winnerEntryId: n1.redEntryId, version: n1.version, clientEventId: randomUUID() });
    await expect(generateBracket(f.user.id, f.r63, { type: 'single' })).rejects.toThrow('không bốc thăm lại');
    await expect(swapEntries(f.user.id, b.id, n1.redEntryId!, n1.blueEntryId!)).rejects.toThrow('không đổi vị trí');
    const other = await createUser('khac@vidu.com');
    await expect(recordResult({ userId: other.id }, { matchId: m2!.id, winnerEntryId: m2!.redEntryId, version: 0, clientEventId: randomUUID() })).rejects.toThrow(
      'không có quyền',
    );
  });

  it('hạng Toàn năng tự nhận VĐV khi hạng nguồn xong', async () => {
    const f = await setup(3);
    const d = await getTournamentForEdit(f.user.id, f.tournament.id);
    await saveCategories(f.user.id, f.tournament.id, {
      categories: [
        ...d.categories.map((c) => ({ ...c, key: c.id, allAroundSourceKeys: [] })),
        { key: 'aa', kind: 'all_around', hand: 'right', gender: 'male', label: 'Toàn năng', allAroundMaxPlace: 2, allAroundSourceKeys: [f.r63] },
      ],
    });
    const aa = (await getTournamentForEdit(f.user.id, f.tournament.id)).categories.find((c) => c.kind === 'all_around')!;
    const b = await generateBracket(f.user.id, f.r63, { type: 'single', thirdPlaceMatch: false, seed: 2 });
    let guard = 0;
    while (guard++ < 10) {
      const r = await ready(b.id);
      if (!r.length) break;
      await recordResult({ userId: f.user.id }, { matchId: r[0]!.id, winnerEntryId: r[0]!.redEntryId, version: r[0]!.version, clientEventId: randomUUID() });
    }
    const auto = await db.select().from(registrationEntries).where(eq(registrationEntries.categoryId, aa.id));
    expect(auto).toHaveLength(2); // HCV + HCB
    expect(auto.every((e) => e.autoAdded && e.fee === 0)).toBe(true);
  });
});
