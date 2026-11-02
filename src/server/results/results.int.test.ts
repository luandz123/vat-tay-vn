import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => import('@/test/pglite-db'));

import { eq } from 'drizzle-orm';
import { matches, tournaments, users } from '@/db/schema';
import { adminOverview, auditLog, setTournamentStatus, setUserRole } from '@/server/admin/service';
import { generateBracket, recordResult } from '@/server/brackets/service';
import { confirmWeighIn } from '@/server/checkin/service';
import { register } from '@/server/registration/service';
import { saveSchedule, getTournamentForEdit } from '@/server/tournaments/service';
import { athleteInput, NOW, publishedTournament } from '@/test/fixtures';
import { createUser, db, resetDb } from '@/test/pglite-db';
import { finishTournament, getResults } from './service';

beforeEach(resetDb);

describe('kết quả & admin', () => {
  it('xếp hạng kèm giải thưởng, kết thúc giải, nhật ký kết quả', async () => {
    const f = await publishedTournament();
    const d = await getTournamentForEdit(f.user.id, f.tournament.id);
    await saveSchedule(f.user.id, f.tournament.id, {
      sessions: [],
      assignments: {},
      prizes: [
        { key: 'a', categoryKey: null, place: 1, title: 'Nhất', description: 'HCV', cashAmount: 500000 },
        { key: 'b', categoryKey: f.r63, place: 1, title: 'Nhất -63', description: 'Cúp', cashAmount: 1000000 },
      ],
    });
    for (let i = 0; i < 2; i++) {
      const { registration } = await register(f.tournament.id, athleteInput({ fullName: `VĐV ${i}`, phone: `098100000${i}`, categoryIds: [f.r63] }), { source: 'online', now: NOW });
      await confirmWeighIn(f.user.id, f.tournament.id, registration.id, '60');
    }
    await expect(finishTournament(f.user.id, f.tournament.id)).rejects.toThrow('chưa có kết quả');
    const b = await generateBracket(f.user.id, f.r63, { type: 'single', seed: 1 });
    const [m] = await db.select().from(matches).where(eq(matches.bracketId, b.id));
    await recordResult({ userId: f.user.id }, { matchId: m!.id, winnerEntryId: m!.redEntryId, version: m!.version, clientEventId: randomUUID() });
    expect((await db.query.tournaments.findFirst({ where: eq(tournaments.id, f.tournament.id) }))!.status).toBe('ongoing');

    const res = await getResults(f.tournament.id);
    const r63 = res.find((r) => r.category.id === f.r63)!;
    expect(r63.placings.map((p) => p.place)).toEqual([1, 2]);
    expect(r63.placings[0]!.prize!.title).toBe('Nhất -63'); // giải riêng của hạng ưu tiên
    expect(d.categories.length).toBe(3);

    await finishTournament(f.user.id, f.tournament.id, true);
    expect((await db.query.tournaments.findFirst({ where: eq(tournaments.id, f.tournament.id) }))!.status).toBe('finished');

    const admin = await createUser('admin@vidu.com');
    await expect(adminOverview(admin.id)).rejects.toThrow('không có quyền');
    await db.update(users).set({ role: 'admin' }).where(eq(users.id, admin.id));
    const ov = await adminOverview(admin.id);
    expect(ov.counts).toMatchObject({ tournaments: 1, registrations: 2 });
    const logs = await auditLog(admin.id, { tournamentId: f.tournament.id });
    expect(logs.map((l) => l.log.action)).toEqual(expect.arrayContaining(['result.set', 'bracket.generate']));
    await setTournamentStatus(admin.id, f.tournament.id, 'cancelled');
    await expect(setUserRole(admin.id, admin.id, 'user')).rejects.toThrow('chính mình');
  });
});
