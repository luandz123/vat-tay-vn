/** Kết quả cuối giải: xếp hạng từng hạng mục, kết thúc giải, danh sách nhận bằng khen. */
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { athletes, auditLogs, categories, categoryResults, prizes, registrationEntries, tournaments } from '@/db/schema';
import { AppError } from '../shared/errors';
import { requireTournament } from '../tournaments/service';

export const PLACE_LABEL: Record<number, string> = { 1: 'Nhất', 2: 'Nhì', 3: 'Ba', 4: 'Khuyến khích' };

export async function getResults(tournamentId: string) {
  const cats = await db.select().from(categories).where(eq(categories.tournamentId, tournamentId)).orderBy(asc(categories.sortOrder));
  if (!cats.length) return [];
  const rows = await db
    .select({ categoryId: categoryResults.categoryId, place: categoryResults.place, name: athletes.fullName, club: athletes.club, entryId: categoryResults.entryId })
    .from(categoryResults)
    .innerJoin(registrationEntries, eq(registrationEntries.id, categoryResults.entryId))
    .innerJoin(athletes, eq(athletes.id, registrationEntries.athleteId))
    .where(inArray(categoryResults.categoryId, cats.map((c) => c.id)))
    .orderBy(asc(categoryResults.place));
  const prz = await db.select().from(prizes).where(eq(prizes.tournamentId, tournamentId));
  return cats.map((c) => ({
    category: c,
    placings: rows
      .filter((r) => r.categoryId === c.id)
      .map((r) => ({
        ...r,
        prize: prz.find((p) => p.categoryId === c.id && p.place === r.place) ?? prz.find((p) => p.categoryId === null && p.place === r.place) ?? null,
      })),
  }));
}

export async function getResultsForUser(userId: string, tournamentId: string) {
  const t = await requireTournament(userId, tournamentId);
  return { tournament: t, results: await getResults(t.id) };
}

/** Kết thúc giải: chỉ khi mọi hạng đã có bảng đều xong (hạng chưa có bảng được bỏ qua). */
export async function finishTournament(userId: string, tournamentId: string, force = false) {
  const t = await requireTournament(userId, tournamentId);
  const res = await getResults(t.id);
  const unfinished = res.filter((r) => r.category.kind === 'weight' && r.placings.length === 0);
  if (unfinished.length && !force)
    throw new AppError('INVALID', `Còn ${unfinished.length} hạng chưa có kết quả: ${unfinished.map((r) => r.category.label).slice(0, 5).join(', ')}`);
  await db.update(tournaments).set({ status: 'finished', updatedAt: new Date() }).where(and(eq(tournaments.id, t.id)));
  await db.insert(auditLogs).values({ tournamentId: t.id, actorUserId: userId, entity: 'tournament', entityId: t.id, action: 'tournament.finish', before: { status: t.status }, after: { status: 'finished' } });
}
