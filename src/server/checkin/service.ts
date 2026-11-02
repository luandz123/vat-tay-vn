/** Check-in & cân ký tại sân. Hệ thống gợi ý; BTC xác nhận và có thể chuyển hạng thủ công. */
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { athletes, auditLogs, categories, registrationEntries, registrations } from '@/db/schema';
import { AppError, notFound } from '../shared/errors';
import { requireTournament } from '../tournaments/service';
import { evaluateWeigh, parseKg, type WeightClass } from './weigh';

const toClass = (c: typeof categories.$inferSelect): WeightClass => ({
  id: c.id,
  hand: c.hand,
  gender: c.gender,
  label: c.label,
  weightMinKg: c.weightMinKg === null ? null : Number(c.weightMinKg),
  weightMaxKg: c.weightMaxKg === null ? null : Number(c.weightMaxKg),
  sortOrder: c.sortOrder,
});

/** Tìm đăng ký bằng token vé (quét QR — chấp nhận cả URL đầy đủ) trong giải. */
export async function findByTicket(userId: string, tournamentId: string, scanned: string) {
  const t = await requireTournament(userId, tournamentId);
  const token = scanned.trim().split('/').pop() ?? '';
  const reg = await db.query.registrations.findFirst({ where: and(eq(registrations.ticketToken, token), eq(registrations.tournamentId, t.id)) });
  return reg?.id ?? null;
}

export async function getCheckinDetail(userId: string, tournamentId: string, registrationId: string) {
  const t = await requireTournament(userId, tournamentId);
  const reg = await db.query.registrations.findFirst({ where: and(eq(registrations.id, registrationId), eq(registrations.tournamentId, t.id)) });
  if (!reg) throw notFound('Không tìm thấy đăng ký');
  const athlete = (await db.query.athletes.findFirst({ where: eq(athletes.id, reg.athleteId) }))!;
  const all = (await db.select().from(categories).where(and(eq(categories.tournamentId, t.id), eq(categories.kind, 'weight'))).orderBy(asc(categories.sortOrder))).map(toClass);
  const entries = await db
    .select({ id: registrationEntries.id, categoryId: registrationEntries.categoryId, weighResult: registrationEntries.weighResult, movedFromEntryId: registrationEntries.movedFromEntryId })
    .from(registrationEntries)
    .where(and(eq(registrationEntries.registrationId, reg.id), eq(registrationEntries.status, 'active')));
  return {
    tournament: { id: t.id, toleranceKg: Number(t.weightToleranceKg), birthYearMin: t.birthYearMin, birthYearMax: t.birthYearMax },
    registration: { ...reg, weighedKg: reg.weighedKg === null ? null : Number(reg.weighedKg) },
    athlete,
    classes: all,
    entries: entries.map((e) => ({ ...e, category: all.find((c) => c.id === e.categoryId)! })).filter((e) => e.category),
  };
}
export type CheckinDetail = Awaited<ReturnType<typeof getCheckinDetail>>;

/** Gợi ý theo số cân (không ghi DB) — dùng chung cho màn hình. */
export function verdicts(detail: Pick<CheckinDetail, 'entries' | 'classes' | 'tournament'>, kg: number) {
  return detail.entries.map((e) => ({ entryId: e.id, ...evaluateWeigh(kg, e.category, detail.classes, detail.tournament.toleranceKg) }));
}

/** Xác nhận cân & check-in: lưu số cân, kết quả gợi ý từng hạng, thời điểm check-in. */
export async function confirmWeighIn(userId: string, tournamentId: string, registrationId: string, kgInput: string) {
  const kg = parseKg(kgInput);
  if (kg === null) throw new AppError('INVALID', 'Số cân không hợp lệ');
  const detail = await getCheckinDetail(userId, tournamentId, registrationId);
  const vs = verdicts(detail, kg);
  await db.transaction(async (tx) => {
    await tx
      .update(registrations)
      .set({ weighedKg: kg.toFixed(2), weighedAt: new Date(), weighedBy: userId, checkedInAt: detail.registration.checkedInAt ?? new Date(), updatedAt: new Date() })
      .where(eq(registrations.id, registrationId));
    for (const v of vs) {
      await tx.update(registrationEntries).set({ weighResult: v.pass ? 'pass' : 'fail' }).where(eq(registrationEntries.id, v.entryId));
    }
    await tx.insert(auditLogs).values({
      tournamentId, actorUserId: userId, entity: 'registration', entityId: registrationId, action: 'checkin.weigh',
      before: { weighedKg: detail.registration.weighedKg }, after: { weighedKg: kg, results: vs.map((v) => ({ entryId: v.entryId, pass: v.pass })) },
    });
  });
  return vs;
}

/** Chuyển hạng thủ công: entry cũ 'moved', tạo entry mới (giữ phí đã tính, không thu thêm). */
export async function moveEntry(userId: string, tournamentId: string, entryId: string, toCategoryId: string) {
  const t = await requireTournament(userId, tournamentId);
  return db.transaction(async (tx) => {
    const [e] = await tx.select().from(registrationEntries).where(eq(registrationEntries.id, entryId)).for('update');
    if (!e || e.status !== 'active') throw new AppError('INVALID', 'Hạng này không còn hiệu lực');
    const [from, to] = await Promise.all([
      tx.query.categories.findFirst({ where: eq(categories.id, e.categoryId) }),
      tx.query.categories.findFirst({ where: and(eq(categories.id, toCategoryId), eq(categories.tournamentId, t.id)) }),
    ]);
    if (!from || from.tournamentId !== t.id || !to || to.kind !== 'weight') throw new AppError('INVALID', 'Hạng đích không hợp lệ');
    if (to.hand !== from.hand) throw new AppError('INVALID', 'Chỉ chuyển sang hạng cùng tay');
    const dup = await tx
      .select({ id: registrationEntries.id })
      .from(registrationEntries)
      .where(and(eq(registrationEntries.categoryId, to.id), eq(registrationEntries.athleteId, e.athleteId), eq(registrationEntries.status, 'active')));
    if (dup.length) throw new AppError('CONFLICT', 'VĐV đã có trong hạng này');
    await tx.update(registrationEntries).set({ status: 'moved' }).where(eq(registrationEntries.id, e.id));
    const [created] = await tx
      .insert(registrationEntries)
      .values({ registrationId: e.registrationId, categoryId: to.id, athleteId: e.athleteId, fee: e.fee, priceTierId: e.priceTierId, movedFromEntryId: e.id })
      .returning();
    await tx.insert(auditLogs).values({
      tournamentId: t.id, actorUserId: userId, entity: 'registration', entityId: e.registrationId, action: 'entry.move',
      before: { categoryId: from.id, label: from.label }, after: { categoryId: to.id, label: to.label },
    });
    return created!;
  });
}
