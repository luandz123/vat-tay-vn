import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => import('@/test/pglite-db'));

import { eq } from 'drizzle-orm';
import { matches } from '@/db/schema';
import { confirmWeighIn } from '@/server/checkin/service';
import { register } from '@/server/registration/service';
import { athleteInput, NOW, publishedTournament } from '@/test/fixtures';
import { db, resetDb } from '@/test/pglite-db';
import { autoAssignTables, createTable, generateBracket, getTableQueue, lockBracket, recordResult, setAutoAssign } from './service';

beforeEach(resetDb);

async function setup(n: number) {
  const f = await publishedTournament();
  for (let i = 0; i < n; i++) {
    const { registration } = await register(f.tournament.id, athleteInput({ fullName: `VĐV ${i}`, phone: `09810000${String(i).padStart(2, '0')}`, categoryIds: [f.r63] }), {
      source: 'online',
      now: NOW,
    });
    await confirmWeighIn(f.user.id, f.tournament.id, registration.id, '60');
  }
  return f;
}

describe('tự động gán bàn (integration)', () => {
  it('chỉ gán khi bảng đã khóa; trọng tài bấm kết quả xong bàn tự nhận trận mới', async () => {
    const f = await setup(8);
    const t1 = await createTable(f.user.id, f.tournament.id, 'Bàn 1');
    const t2 = await createTable(f.user.id, f.tournament.id, 'Bàn 2');
    const b = await generateBracket(f.user.id, f.r63, { type: 'single', seed: 1 });

    expect(await autoAssignTables(f.tournament.id)).toBe(0); // bảng nháp
    await lockBracket(f.user.id, b.id, true);
    expect(await autoAssignTables(f.tournament.id)).toBe(4); // 2 bàn × 2 trận
    expect((await getTableQueue(t1.id)).queue).toHaveLength(2);
    expect((await getTableQueue(t2.id)).queue).toHaveLength(2);

    // Trọng tài Bàn 1 ghi kết quả trận đầu hàng chờ → bàn còn 1 trận → không còn trận vòng 1 nào để gán
    const [cur] = (await getTableQueue(t1.id)).queue;
    await recordResult({ tableId: t1.id }, { matchId: cur!.id, winnerEntryId: cur!.redEntryId, version: cur!.version, clientEventId: randomUUID() });
    expect(await autoAssignTables(f.tournament.id)).toBe(0);

    // Bàn 2 xong cả 2 trận → bán kết của nhánh trên (2 người thắng bàn 1/2) sẵn sàng
    for (const m of (await getTableQueue(t2.id)).queue) {
      const fresh = (await db.query.matches.findFirst({ where: eq(matches.id, m.id) }))!;
      await recordResult({ tableId: t2.id }, { matchId: fresh.id, winnerEntryId: fresh.redEntryId, version: fresh.version, clientEventId: randomUUID() });
    }
    const assigned = await autoAssignTables(f.tournament.id, new Date(Date.now() + 10 * 60_000));
    expect(assigned).toBeGreaterThanOrEqual(1);
    const all = await db.select().from(matches).where(eq(matches.bracketId, b.id));
    const onTables = all.filter((m) => m.status === 'on_table');
    // Không VĐV nào ở 2 bàn cùng lúc
    const people = onTables.flatMap((m) => [m.redEntryId, m.blueEntryId]);
    expect(new Set(people).size).toBe(people.length);
  });

  it('tắt tự động thì không gán', async () => {
    const f = await setup(4);
    await createTable(f.user.id, f.tournament.id, 'Bàn 1');
    const b = await generateBracket(f.user.id, f.r63, { type: 'single', seed: 1 });
    await setAutoAssign(f.user.id, f.tournament.id, false);
    await lockBracket(f.user.id, b.id, true);
    expect(await autoAssignTables(f.tournament.id)).toBe(0);
    await setAutoAssign(f.user.id, f.tournament.id, true); // bật lại → gán ngay
    expect((await db.select().from(matches).where(eq(matches.status, 'on_table')))).toHaveLength(2);
  });
});
