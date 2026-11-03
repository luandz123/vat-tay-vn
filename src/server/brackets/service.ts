/**
 * Bảng đấu trong DB. Khung trận lưu ở `matches` (con trỏ next/loserNext, VĐV vòng 1); trạng thái
 * luôn được tính lại bằng engine sau mỗi thay đổi rồi ghi phần khác biệt.
 */
import { and, asc, eq, inArray, isNotNull, isNull, notInArray, sql } from 'drizzle-orm';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db } from '@/db';
import {
  allAroundSources,
  armTables,
  athletes,
  auditLogs,
  brackets,
  categories,
  categoryResults,
  matchEvents,
  matches,
  registrationEntries,
  registrations,
  sessions,
  tournaments,
} from '@/db/schema';
import { AppError, notFound } from '../shared/errors';
import { requireTournament } from '../tournaments/service';
import {
  canUndo,
  computeState,
  finalPlacings,
  generateSkeleton,
  rng,
  shuffle,
  type BracketOptions,
  type MatchState,
  type SkeletonMatch,
} from './engine';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type MatchRow = typeof matches.$inferSelect;
type BracketRow = typeof brackets.$inferSelect;

/** Người thao tác: thành viên BTC hoặc tablet của một bàn. */
export type Actor = { userId: string } | { tableId: string };

/* ───────────── Khung ↔ DB ───────────── */

function toSkeleton(rows: MatchRow[]): SkeletonMatch[] {
  return rows.map((m) => ({
    key: m.id,
    side: m.side,
    round: m.round,
    position: m.position,
    number: m.number,
    red: m.side === 'winners' && m.round === 1 ? m.redEntryId : null,
    blue: m.side === 'winners' && m.round === 1 ? m.blueEntryId : null,
    next: m.nextMatchId,
    nextSlot: m.nextSlot,
    loserNext: m.loserNextMatchId,
    loserNextSlot: m.loserNextSlot,
  }));
}

const optsOf = (b: BracketRow): BracketOptions => ({ type: b.type, thirdPlaceMatch: b.thirdPlaceMatch, grandFinalReset: b.grandFinalReset });

/** Tính lại toàn bảng từ kết quả hiện có; ghi khác biệt; cập nhật trạng thái bảng & xếp hạng. */
async function recompute(tx: Tx, bracket: BracketRow, results?: Map<string, string>) {
  const rows = await tx.select().from(matches).where(eq(matches.bracketId, bracket.id)).orderBy(asc(matches.number));
  const res = results ?? new Map(rows.filter((m) => m.status === 'finished' && m.winnerEntryId).map((m) => [m.id, m.winnerEntryId!]));
  const states = computeState(toSkeleton(rows), res);
  for (const s of states) {
    const row = rows.find((r) => r.id === s.key)!;
    let status: MatchRow['status'] = s.status;
    let tableId = row.tableId;
    if (s.status === 'ready' && row.tableId) status = row.status === 'in_progress' ? 'in_progress' : 'on_table';
    if (s.status !== 'ready' && s.status !== 'finished') tableId = null;
    const changed =
      row.redEntryId !== s.red || row.blueEntryId !== s.blue || row.winnerEntryId !== s.winner || row.status !== status || row.tableId !== tableId;
    if (changed) {
      await tx
        .update(matches)
        .set({
          redEntryId: s.red,
          blueEntryId: s.blue,
          winnerEntryId: s.winner,
          status,
          tableId,
          finishedAt: s.status === 'finished' ? (row.finishedAt ?? new Date()) : null,
          version: sql`${matches.version} + 1`,
        })
        .where(eq(matches.id, row.id));
    }
  }
  const anyFinished = states.some((s) => s.status === 'finished');
  const placings = finalPlacings(states, optsOf(bracket));
  const status: BracketRow['status'] = placings ? 'finished' : anyFinished ? 'in_progress' : bracket.status === 'locked' ? 'locked' : 'draft';
  if (status !== bracket.status) await tx.update(brackets).set({ status }).where(eq(brackets.id, bracket.id));

  await tx.delete(categoryResults).where(eq(categoryResults.categoryId, bracket.categoryId));
  if (placings?.length) {
    await tx.insert(categoryResults).values(placings.map((p) => ({ categoryId: bracket.categoryId, entryId: p.entry, place: p.place })));
    await fillAllAround(tx, bracket.categoryId);
  }
  return states;
}

/* ───────────── Hạng Toàn năng tự động ───────────── */

/** Khi mọi hạng nguồn đã có kết quả: đưa VĐV đạt huy chương vào hạng Toàn năng (không thu phí). */
async function fillAllAround(tx: Tx, finishedCategoryId: string) {
  const targets = await tx
    .select({ id: allAroundSources.allAroundCategoryId })
    .from(allAroundSources)
    .where(eq(allAroundSources.sourceCategoryId, finishedCategoryId));
  for (const { id } of targets) {
    const aa = await tx.query.categories.findFirst({ where: eq(categories.id, id) });
    if (!aa) continue;
    const existing = await tx.select({ id: brackets.id, status: brackets.status }).from(brackets).where(eq(brackets.categoryId, aa.id));
    if (existing[0] && existing[0].status !== 'draft') continue; // bảng Toàn năng đã bắt đầu thì không đổi
    const sources = await tx.select({ sid: allAroundSources.sourceCategoryId }).from(allAroundSources).where(eq(allAroundSources.allAroundCategoryId, aa.id));
    const sourceIds = sources.map((s) => s.sid);
    const done = await tx
      .select({ categoryId: categoryResults.categoryId })
      .from(categoryResults)
      .where(inArray(categoryResults.categoryId, sourceIds))
      .groupBy(categoryResults.categoryId);
    if (done.length < sourceIds.length) continue;
    const medalists = await tx
      .select({ athleteId: registrationEntries.athleteId, registrationId: registrationEntries.registrationId })
      .from(categoryResults)
      .innerJoin(registrationEntries, eq(registrationEntries.id, categoryResults.entryId))
      .where(and(inArray(categoryResults.categoryId, sourceIds), sql`${categoryResults.place} <= ${aa.allAroundMaxPlace ?? 1}`));
    const seen = new Set<string>();
    for (const m of medalists) {
      if (seen.has(m.athleteId)) continue;
      seen.add(m.athleteId);
      await tx
        .insert(registrationEntries)
        .values({ registrationId: m.registrationId, categoryId: aa.id, athleteId: m.athleteId, fee: 0, autoAdded: true })
        .onConflictDoNothing();
    }
  }
}

/* ───────────── BTC: sinh bảng, đổi vị trí ───────────── */

export const generateInput = z.object({
  type: z.enum(['single', 'double']).default('double'),
  thirdPlaceMatch: z.boolean().default(true),
  grandFinalReset: z.boolean().default(true),
  onlyCheckedIn: z.boolean().default(true),
  seed: z.number().int().optional(),
});

async function requireCategory(userId: string, categoryId: string) {
  const c = await db.query.categories.findFirst({ where: eq(categories.id, categoryId) });
  if (!c) throw notFound('Không tìm thấy hạng mục');
  await requireTournament(userId, c.tournamentId);
  return c;
}

/** Danh sách VĐV đủ điều kiện xếp bảng trong hạng. */
async function eligibleEntries(tx: Tx, categoryId: string, onlyCheckedIn: boolean) {
  const rows = await tx
    .select({ id: registrationEntries.id })
    .from(registrationEntries)
    .innerJoin(registrations, eq(registrations.id, registrationEntries.registrationId))
    .where(
      and(
        eq(registrationEntries.categoryId, categoryId),
        eq(registrationEntries.status, 'active'),
        notInArray(registrations.status, ['cancelled', 'rejected']),
        ...(onlyCheckedIn ? [isNotNull(registrations.checkedInAt)] : []),
      ),
    )
    .orderBy(asc(registrationEntries.createdAt));
  return rows.map((r) => r.id);
}

/** Bốc thăm ngẫu nhiên và sinh (lại) bảng. Chỉ khi bảng chưa có trận nào đấu xong. */
export async function generateBracket(userId: string, categoryId: string, raw: unknown) {
  const c = await requireCategory(userId, categoryId);
  const v = generateInput.parse(raw);
  return db.transaction(async (tx) => {
    const [old] = await tx.select().from(brackets).where(eq(brackets.categoryId, c.id)).for('update');
    if (old && (old.status === 'in_progress' || old.status === 'finished')) throw new AppError('CONFLICT', 'Bảng đã có trận đấu xong, không bốc thăm lại được');
    const entries = await eligibleEntries(tx, c.id, v.onlyCheckedIn);
    if (entries.length < 2) throw new AppError('INVALID', v.onlyCheckedIn ? 'Cần ít nhất 2 VĐV đã check-in' : 'Cần ít nhất 2 VĐV');
    const seed = v.seed ?? randomBytes(4).readUInt32BE(0) >>> 1; // vừa kiểu integer của Postgres
    const opts: BracketOptions = { type: v.type, thirdPlaceMatch: v.thirdPlaceMatch, grandFinalReset: v.grandFinalReset };
    const sk = generateSkeleton(shuffle(entries, rng(seed)), opts);
    const ids = new Map(sk.map((m) => [m.key, randomUUID()]));

    let bracket: BracketRow;
    if (old) {
      await tx.delete(matches).where(eq(matches.bracketId, old.id));
      [bracket] = (await tx
        .update(brackets)
        .set({ type: v.type, thirdPlaceMatch: v.thirdPlaceMatch, grandFinalReset: v.grandFinalReset, status: 'draft', drawSeed: seed, generatedAt: new Date(), lockedAt: null })
        .where(eq(brackets.id, old.id))
        .returning()) as [BracketRow];
    } else {
      [bracket] = (await tx
        .insert(brackets)
        .values({ categoryId: c.id, type: v.type, thirdPlaceMatch: v.thirdPlaceMatch, grandFinalReset: v.grandFinalReset, drawSeed: seed, generatedAt: new Date() })
        .returning()) as [BracketRow];
    }
    await tx.insert(matches).values(
      sk.map((m) => ({
        id: ids.get(m.key)!,
        bracketId: bracket.id,
        side: m.side,
        round: m.round,
        position: m.position,
        number: m.number,
        redEntryId: m.red,
        blueEntryId: m.blue,
        nextMatchId: m.next ? ids.get(m.next)! : null,
        nextSlot: m.nextSlot,
        loserNextMatchId: m.loserNext ? ids.get(m.loserNext)! : null,
        loserNextSlot: m.loserNextSlot,
      })),
    );
    await recompute(tx, bracket);
    await tx.insert(auditLogs).values({
      tournamentId: c.tournamentId, actorUserId: userId, entity: 'bracket', entityId: bracket.id, action: old ? 'bracket.redraw' : 'bracket.generate',
      before: null, after: { type: v.type, entries: entries.length, seed },
    });
    return bracket;
  });
}

/** Kéo thả chỉnh bảng: hoán đổi vị trí 2 VĐV ở vòng 1 (chỉ khi chưa khóa / chưa đấu). */
export async function swapEntries(userId: string, bracketId: string, entryA: string, entryB: string) {
  const b = await db.query.brackets.findFirst({ where: eq(brackets.id, bracketId) });
  if (!b) throw notFound('Không tìm thấy bảng');
  const c = await requireCategory(userId, b.categoryId);
  if (b.status !== 'draft') throw new AppError('CONFLICT', 'Bảng đã khóa hoặc đã bắt đầu, không đổi vị trí được');
  if (entryA === entryB) return;
  await db.transaction(async (tx) => {
    const r1 = await tx
      .select()
      .from(matches)
      .where(and(eq(matches.bracketId, b.id), eq(matches.side, 'winners'), eq(matches.round, 1)));
    const where = (e: string) => {
      const m = r1.find((x) => x.redEntryId === e || x.blueEntryId === e);
      return m ? { m, slot: m.redEntryId === e ? ('red' as const) : ('blue' as const) } : null;
    };
    const a = where(entryA);
    const z2 = where(entryB);
    if (!a || !z2) throw new AppError('INVALID', 'VĐV không ở vòng 1');
    const col = (s: 'red' | 'blue') => (s === 'red' ? 'redEntryId' : 'blueEntryId');
    if (a.m.id === z2.m.id) {
      await tx.update(matches).set({ redEntryId: a.m.blueEntryId, blueEntryId: a.m.redEntryId }).where(eq(matches.id, a.m.id));
    } else {
      await tx.update(matches).set({ [col(a.slot)]: entryB }).where(eq(matches.id, a.m.id));
      await tx.update(matches).set({ [col(z2.slot)]: entryA }).where(eq(matches.id, z2.m.id));
    }
    await recompute(tx, b);
    await tx.insert(auditLogs).values({ tournamentId: c.tournamentId, actorUserId: userId, entity: 'bracket', entityId: b.id, action: 'bracket.swap', before: { entryA, entryB }, after: null });
  });
}

export async function lockBracket(userId: string, bracketId: string, locked: boolean) {
  const b = await db.query.brackets.findFirst({ where: eq(brackets.id, bracketId) });
  if (!b) throw notFound();
  await requireCategory(userId, b.categoryId);
  if (b.status !== 'draft' && b.status !== 'locked') return;
  await db.update(brackets).set({ status: locked ? 'locked' : 'draft', lockedAt: locked ? new Date() : null }).where(eq(brackets.id, b.id));
}

/* ───────────── Bàn đấu ───────────── */

export const hashCode = (s: string) => createHash('sha256').update(s).digest('hex');

export async function createTable(userId: string, tournamentId: string, name: string) {
  const t = await requireTournament(userId, tournamentId);
  const n = z.string().trim().min(1).max(30).parse(name);
  const [{ max }] = (await db.select({ max: sql<number>`coalesce(max(${armTables.sortOrder}), -1)::int` }).from(armTables).where(eq(armTables.tournamentId, t.id))) as [{ max: number }];
  const [row] = await db.insert(armTables).values({ tournamentId: t.id, name: n, sortOrder: max + 1 }).returning();
  return row!;
}

export async function updateTable(userId: string, tableId: string, patch: { name?: string; refereeName?: string | null; status?: 'active' | 'paused' }) {
  const tb = await db.query.armTables.findFirst({ where: eq(armTables.id, tableId) });
  if (!tb) throw notFound();
  await requireTournament(userId, tb.tournamentId);
  await db.update(armTables).set(patch).where(eq(armTables.id, tb.id));
}

export async function deleteTable(userId: string, tableId: string) {
  const tb = await db.query.armTables.findFirst({ where: eq(armTables.id, tableId) });
  if (!tb) throw notFound();
  await requireTournament(userId, tb.tournamentId);
  const busy = await db.select({ id: matches.id }).from(matches).where(and(eq(matches.tableId, tb.id), inArray(matches.status, ['in_progress'])));
  if (busy.length) throw new AppError('CONFLICT', 'Bàn đang có trận đấu');
  await db.transaction(async (tx) => {
    await tx.update(matches).set({ tableId: null, status: 'ready' }).where(and(eq(matches.tableId, tb.id), eq(matches.status, 'on_table')));
    await tx.update(matches).set({ tableId: null }).where(eq(matches.tableId, tb.id));
    await tx.delete(armTables).where(eq(armTables.id, tb.id));
  });
}

/** Tạo mã truy cập tablet cho bàn (hiện 1 lần; DB lưu SHA-256). */
export async function issueTableCode(userId: string, tableId: string) {
  const tb = await db.query.armTables.findFirst({ where: eq(armTables.id, tableId) });
  if (!tb) throw notFound();
  await requireTournament(userId, tb.tournamentId);
  const code = randomBytes(12).toString('base64url');
  await db.update(armTables).set({ accessTokenHash: hashCode(code) }).where(eq(armTables.id, tb.id));
  return code;
}

export async function tableByCode(code: string) {
  if (!/^[A-Za-z0-9_-]{10,40}$/.test(code)) return null;
  return (await db.query.armTables.findFirst({ where: eq(armTables.accessTokenHash, hashCode(code)) })) ?? null;
}

/** Gán trận vào bàn (hoặc gỡ khỏi bàn khi tableId = null). Trận vào cuối hàng chờ của bàn. */
export async function assignTable(userId: string, matchId: string, tableId: string | null) {
  const m = await db.query.matches.findFirst({ where: eq(matches.id, matchId) });
  if (!m) throw notFound('Không tìm thấy trận');
  const b = (await db.query.brackets.findFirst({ where: eq(brackets.id, m.bracketId) }))!;
  const c = await requireCategory(userId, b.categoryId);
  if (m.status === 'finished' || m.status === 'in_progress') throw new AppError('CONFLICT', 'Trận đã bắt đầu hoặc đã xong');
  if (tableId) {
    const tb = await db.query.armTables.findFirst({ where: eq(armTables.id, tableId) });
    if (!tb || tb.tournamentId !== c.tournamentId) throw new AppError('INVALID', 'Bàn không hợp lệ');
  }
  await db.transaction(async (tx) => {
    const [{ max }] = tableId
      ? ((await tx.select({ max: sql<number>`coalesce(max(${matches.queuePosition}), 0)::int` }).from(matches).where(eq(matches.tableId, tableId))) as [{ max: number }])
      : [{ max: 0 }];
    await tx
      .update(matches)
      .set({
        tableId,
        queuePosition: tableId ? max + 1 : null,
        status: tableId ? (m.status === 'ready' || m.status === 'on_table' ? 'on_table' : m.status) : m.status === 'on_table' ? 'ready' : m.status,
        version: sql`${matches.version} + 1`,
      })
      .where(eq(matches.id, m.id));
    await tx.insert(matchEvents).values({ matchId: m.id, type: 'assign_table', payload: { tableId }, clientEventId: randomUUID(), actorUserId: userId });
  });
  return c.tournamentId;
}

/* ───────────── Trọng tài: kết quả, hoàn tác, lỗi ───────────── */

/**
 * Kiểm tra quyền NGOÀI transaction (đọc bằng `db`), trả bối cảnh trận. Quyền theo bàn được kiểm tra lại
 * trên dòng đã khóa trong transaction bằng `assertTable`.
 */
async function authorizeMatch(actor: Actor, matchId: string) {
  const m = await db.query.matches.findFirst({ where: eq(matches.id, matchId) });
  if (!m) throw notFound('Không tìm thấy trận');
  const b = (await db.query.brackets.findFirst({ where: eq(brackets.id, m.bracketId) }))!;
  const c = (await db.query.categories.findFirst({ where: eq(categories.id, b.categoryId) }))!;
  if ('userId' in actor) await requireTournament(actor.userId, c.tournamentId);
  else assertTable(actor, m);
  return { bracket: b, category: c };
}

function assertTable(actor: Actor, m: MatchRow) {
  if ('tableId' in actor && m.tableId !== actor.tableId) throw new AppError('FORBIDDEN', 'Trận này không thuộc bàn của bạn');
}

const actorCols = (a: Actor) => ('userId' in a ? { actorUserId: a.userId } : { actorTableId: a.tableId });

export const resultInput = z.object({
  matchId: z.uuid(),
  winnerEntryId: z.uuid(),
  version: z.number().int(),
  clientEventId: z.uuid(),
});

/**
 * Ghi người thắng. Idempotent theo clientEventId (bấm 2 lần / gửi lại không ghi trùng);
 * optimistic lock theo version (2 thiết bị cùng sửa thì một bên bị từ chối).
 */
export async function recordResult(actor: Actor, raw: unknown) {
  const v = resultInput.parse(raw);
  const { bracket, category } = await authorizeMatch(actor, v.matchId);
  return db.transaction(async (tx) => {
    const dup = await tx.select({ id: matchEvents.id }).from(matchEvents).where(eq(matchEvents.clientEventId, v.clientEventId));
    if (dup.length) return { tournamentId: category.tournamentId, duplicate: true };
    const [m] = await tx.select().from(matches).where(eq(matches.id, v.matchId)).for('update');
    if (!m) throw notFound('Không tìm thấy trận');
    assertTable(actor, m);
    if (m.version !== v.version) throw new AppError('CONFLICT', 'Trận vừa được cập nhật ở thiết bị khác, hãy tải lại');
    if (!['ready', 'on_table', 'in_progress'].includes(m.status)) throw new AppError('CONFLICT', 'Trận chưa sẵn sàng hoặc đã có kết quả');
    if (v.winnerEntryId !== m.redEntryId && v.winnerEntryId !== m.blueEntryId) throw new AppError('INVALID', 'Người thắng không thuộc trận này');
    await tx.insert(matchEvents).values({ matchId: m.id, type: 'result', entryId: v.winnerEntryId, clientEventId: v.clientEventId, ...actorCols(actor) });
    const rows = await tx.select({ id: matches.id, status: matches.status, winner: matches.winnerEntryId }).from(matches).where(eq(matches.bracketId, bracket.id));
    const results = new Map(rows.filter((r) => r.status === 'finished' && r.winner).map((r) => [r.id, r.winner!]));
    results.set(m.id, v.winnerEntryId);
    await tx.update(matches).set({ status: 'finished', winnerEntryId: v.winnerEntryId }).where(eq(matches.id, m.id));
    await recompute(tx, bracket, results);
    // Trận đầu tiên có kết quả → giải chuyển sang "đang thi đấu" (khán giả thấy link trực tiếp)
    await tx.update(tournaments).set({ status: 'ongoing' }).where(and(eq(tournaments.id, category.tournamentId), eq(tournaments.status, 'published')));
    await tx.insert(auditLogs).values({
      tournamentId: category.tournamentId, ...actorCols(actor), entity: 'match', entityId: m.id, action: 'result.set',
      before: { winner: m.winnerEntryId, status: m.status }, after: { winner: v.winnerEntryId },
    });
    return { tournamentId: category.tournamentId, duplicate: false };
  });
}

export const undoInput = z.object({ matchId: z.uuid(), clientEventId: z.uuid() });

/** Hoàn tác kết quả (event mới, không xóa lịch sử). Không được nếu trận sau đã đấu xong. */
export async function undoResult(actor: Actor, raw: unknown) {
  const v = undoInput.parse(raw);
  const { bracket, category } = await authorizeMatch(actor, v.matchId);
  return db.transaction(async (tx) => {
    const dup = await tx.select({ id: matchEvents.id }).from(matchEvents).where(eq(matchEvents.clientEventId, v.clientEventId));
    if (dup.length) return { tournamentId: category.tournamentId, duplicate: true };
    const [m] = await tx.select().from(matches).where(eq(matches.id, v.matchId)).for('update');
    if (!m) throw notFound('Không tìm thấy trận');
    assertTable(actor, m);
    const rows = await tx.select().from(matches).where(eq(matches.bracketId, bracket.id));
    const results = new Map(rows.filter((r) => r.status === 'finished' && r.winnerEntryId).map((r) => [r.id, r.winnerEntryId!]));
    const states = computeState(toSkeleton(rows), results);
    if (!canUndo(states, m.id)) throw new AppError('CONFLICT', 'Trận sau đã có kết quả, cần hoàn tác trận sau trước');
    results.delete(m.id);
    await tx.insert(matchEvents).values({ matchId: m.id, type: 'undo', entryId: m.winnerEntryId, clientEventId: v.clientEventId, ...actorCols(actor) });
    await tx.update(matches).set({ status: m.tableId ? 'on_table' : 'ready', winnerEntryId: null, finishedAt: null }).where(eq(matches.id, m.id));
    await recompute(tx, bracket, results);
    await tx.insert(auditLogs).values({
      tournamentId: category.tournamentId, ...actorCols(actor), entity: 'match', entityId: m.id, action: 'result.undo',
      before: { winner: m.winnerEntryId }, after: { winner: null },
    });
    return { tournamentId: category.tournamentId, duplicate: false };
  });
}

export const noteInput = z.object({
  matchId: z.uuid(),
  type: z.enum(['foul', 'warning', 'start', 'note']),
  entryId: z.uuid().optional(),
  note: z.string().max(300).optional(),
  clientEventId: z.uuid(),
});

/** Ghi lỗi / cảnh cáo / bắt đầu trận — chỉ ghi nhận, hệ thống không tự xử thua. */
export async function addMatchEvent(actor: Actor, raw: unknown) {
  const v = noteInput.parse(raw);
  const { category } = await authorizeMatch(actor, v.matchId);
  const m = (await db.query.matches.findFirst({ where: eq(matches.id, v.matchId) }))!;
  await db
    .insert(matchEvents)
    .values({ matchId: m.id, type: v.type, entryId: v.entryId ?? null, payload: v.note ? { note: v.note } : null, clientEventId: v.clientEventId, ...actorCols(actor) })
    .onConflictDoNothing();
  if (v.type === 'start' && m.status === 'on_table') {
    await db.update(matches).set({ status: 'in_progress', startedAt: new Date(), version: sql`${matches.version} + 1` }).where(eq(matches.id, m.id));
  }
  return { tournamentId: category.tournamentId };
}

/* ───────────── Đọc: bảng điều khiển ───────────── */

/** Toàn bộ bảng đấu của giải (cho BTC, tablet, khán giả). Tên VĐV kèm, không có SĐT. */
export async function getBoard(tournamentId: string) {
  const cats = await db.select().from(categories).where(eq(categories.tournamentId, tournamentId)).orderBy(asc(categories.sortOrder));
  const catIds = cats.map((c) => c.id);
  if (!catIds.length) return { categories: [], tables: [], entries: new Map<string, EntryInfo>() };
  const [brs, tables, entryRows] = await Promise.all([
    db.select().from(brackets).where(inArray(brackets.categoryId, catIds)),
    db.select().from(armTables).where(eq(armTables.tournamentId, tournamentId)).orderBy(asc(armTables.sortOrder)),
    db
      .select({ id: registrationEntries.id, categoryId: registrationEntries.categoryId, status: registrationEntries.status, name: athletes.fullName, club: athletes.club, kg: registrations.weighedKg, checkedIn: registrations.checkedInAt, regStatus: registrations.status })
      .from(registrationEntries)
      .innerJoin(athletes, eq(athletes.id, registrationEntries.athleteId))
      .innerJoin(registrations, eq(registrations.id, registrationEntries.registrationId))
      .where(inArray(registrationEntries.categoryId, catIds)),
  ]);
  const ms = brs.length
    ? await db.select().from(matches).where(inArray(matches.bracketId, brs.map((b) => b.id))).orderBy(asc(matches.number))
    : [];
  const results = brs.length ? await db.select().from(categoryResults).where(inArray(categoryResults.categoryId, catIds)) : [];
  const entries = new Map<string, EntryInfo>(entryRows.map((e) => [e.id, { id: e.id, name: e.name, club: e.club, kg: e.kg === null ? null : Number(e.kg) }]));
  return {
    categories: cats.map((c) => {
      const b = brs.find((x) => x.categoryId === c.id) ?? null;
      const eligible = entryRows.filter((e) => e.categoryId === c.id && e.status === 'active' && e.regStatus !== 'cancelled' && e.regStatus !== 'rejected');
      return {
        category: c,
        bracket: b,
        matches: b ? ms.filter((m) => m.bracketId === b.id) : [],
        results: results.filter((r) => r.categoryId === c.id).sort((a, z2) => a.place - z2.place),
        entrantCount: eligible.length,
        checkedInCount: eligible.filter((e) => e.checkedIn).length,
      };
    }),
    tables,
    entries,
  };
}
export interface EntryInfo {
  id: string;
  name: string;
  club: string | null;
  kg: number | null;
}
export type Board = Awaited<ReturnType<typeof getBoard>>;

export async function getBoardForUser(userId: string, tournamentId: string) {
  await requireTournament(userId, tournamentId);
  return getBoard(tournamentId);
}

/** Trận hiện tại và hàng chờ của một bàn (cho tablet). */
export async function getTableQueue(tableId: string) {
  const ms = await db
    .select()
    .from(matches)
    .where(and(eq(matches.tableId, tableId), inArray(matches.status, ['on_table', 'in_progress', 'ready', 'pending'])))
    .orderBy(asc(matches.queuePosition));
  const last = await db
    .select()
    .from(matches)
    .where(and(eq(matches.tableId, tableId), eq(matches.status, 'finished')))
    .orderBy(sql`${matches.finishedAt} desc nulls last`)
    .limit(1);
  return { queue: ms.filter((m) => m.status !== 'pending'), lastFinished: last[0] ?? null };
}

/** Số lỗi/cảnh cáo đã ghi của trận theo VĐV: { [entryId]: { foul, warning } }. */
export async function getMatchTallies(matchId: string): Promise<Record<string, { foul: number; warning: number }>> {
  const ev = await db
    .select({ type: matchEvents.type, entryId: matchEvents.entryId })
    .from(matchEvents)
    .where(and(eq(matchEvents.matchId, matchId), inArray(matchEvents.type, ['foul', 'warning']), isNotNull(matchEvents.entryId)));
  const out: Record<string, { foul: number; warning: number }> = {};
  for (const e of ev) {
    const t = (out[e.entryId!] ??= { foul: 0, warning: 0 });
    if (e.type === 'foul') t.foul++;
    else t.warning++;
  }
  return out;
}

export type { MatchState };

/* ───────────── Tự động gán bàn ───────────── */

/**
 * Gán trận sẵn sàng vào bàn còn chỗ (mỗi bàn tối đa 2 trận: đang đấu + chuẩn bị).
 * Chỉ khi giải bật `autoAssignTables`; chỉ bảng đã khóa/đang đấu. Khóa dòng giải để 2 thiết bị
 * bấm cùng lúc không gán trùng. Trả về số trận vừa gán.
 */
export async function autoAssignTables(tournamentId: string, now = new Date()): Promise<number> {
  const { planAssignments } = await import('./scheduler');
  return db.transaction(async (tx) => {
    const [t] = await tx.select().from(tournaments).where(eq(tournaments.id, tournamentId)).for('update');
    if (!t?.autoAssignTables) return 0;
    const cats = await tx.select().from(categories).where(eq(categories.tournamentId, t.id));
    if (!cats.length) return 0;
    const sess = await tx.select().from(sessions).where(eq(sessions.tournamentId, t.id));
    const brs = await tx.select().from(brackets).where(inArray(brackets.categoryId, cats.map((c) => c.id)));
    if (!brs.length) return 0;
    const tbls = await tx.select().from(armTables).where(eq(armTables.tournamentId, t.id));
    const ms = await tx.select().from(matches).where(inArray(matches.bracketId, brs.map((b) => b.id)));
    const plan = planAssignments(
      tbls.map((x) => ({ id: x.id, sortOrder: x.sortOrder, active: x.status === 'active' })),
      ms.map((m) => {
        const b = brs.find((x) => x.id === m.bracketId)!;
        const c = cats.find((x) => x.id === b.categoryId)!;
        const s = sess.find((x) => x.id === c.sessionId);
        return {
          id: m.id, categoryId: c.id, number: m.number, status: m.status, tableId: m.tableId, queuePosition: m.queuePosition,
          red: m.redEntryId, blue: m.blueEntryId, winner: m.winnerEntryId, finishedAt: m.finishedAt, notBefore: m.notBefore,
          bracketLive: b.status === 'locked' || b.status === 'in_progress',
          sessionStart: s?.competeStart ?? s?.weighInStart ?? null,
          categoryOrder: c.sortOrder,
        };
      }),
      now,
    );
    let n = 0;
    for (const a of plan) {
      const res = await tx
        .update(matches)
        .set({ tableId: a.tableId, queuePosition: a.queuePosition, status: 'on_table', version: sql`${matches.version} + 1` })
        .where(and(eq(matches.id, a.matchId), eq(matches.status, 'ready'), isNull(matches.tableId)))
        .returning({ id: matches.id });
      if (!res.length) continue;
      n++;
      await tx.insert(matchEvents).values({ matchId: a.matchId, type: 'assign_table', payload: { tableId: a.tableId, auto: true }, clientEventId: randomUUID() });
    }
    return n;
  });
}

export const holdInput = z.object({ matchId: z.uuid(), minutes: z.number().int().min(1).max(60), clientEventId: z.uuid() });

/**
 * Trọng tài hoãn trận (VĐV xin nghỉ): trận rời bàn, không được gán lại trước `minutes` phút;
 * bàn tự lấy trận khác. Chỉ trận chưa bắt đầu tính kết quả.
 */
export async function holdMatch(actor: Actor, raw: unknown) {
  const v = holdInput.parse(raw);
  const { category } = await authorizeMatch(actor, v.matchId);
  const until = new Date(Date.now() + v.minutes * 60_000);
  await db.transaction(async (tx) => {
    const dup = await tx.select({ id: matchEvents.id }).from(matchEvents).where(eq(matchEvents.clientEventId, v.clientEventId));
    if (dup.length) return;
    const [m] = await tx.select().from(matches).where(eq(matches.id, v.matchId)).for('update');
    if (!m) throw notFound('Không tìm thấy trận');
    assertTable(actor, m);
    if (m.status !== 'on_table' && m.status !== 'in_progress') throw new AppError('CONFLICT', 'Trận không còn trên bàn');
    await tx
      .update(matches)
      .set({ tableId: null, queuePosition: null, status: 'ready', notBefore: until, startedAt: null, version: sql`${matches.version} + 1` })
      .where(eq(matches.id, m.id));
    await tx.insert(matchEvents).values({ matchId: m.id, type: 'note', payload: { hold: v.minutes, until }, clientEventId: v.clientEventId, ...actorCols(actor) });
    await tx.insert(auditLogs).values({
      tournamentId: category.tournamentId, ...actorCols(actor), entity: 'match', entityId: m.id, action: 'match.hold',
      before: { tableId: m.tableId }, after: { notBefore: until },
    });
  });
  return { tournamentId: category.tournamentId, until };
}

export async function setAutoAssign(userId: string, tournamentId: string, enabled: boolean) {
  const t = await requireTournament(userId, tournamentId);
  await db.update(tournaments).set({ autoAssignTables: enabled, updatedAt: new Date() }).where(eq(tournaments.id, t.id));
  if (enabled) await autoAssignTables(t.id);
}
