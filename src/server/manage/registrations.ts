/** BTC quản lý đăng ký: danh sách, duyệt, sửa, hủy, xác nhận tiền, ghép giao dịch, thống kê, xuất Excel. */
import { and, asc, desc, eq, ilike, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { athletes, auditLogs, categories, payments, registrationEntries, registrations } from '@/db/schema';
import { paymentStatusOf } from '../registration/fees';
import { cleanFullName, normalizeName, normalizePhone } from '../registration/rules';
import { applyPayment } from '../registration/service';
import { AppError, notFound } from '../shared/errors';
import { requireTournament } from '../tournaments/service';

export type RegistrationFilter = 'all' | 'pending' | 'unpaid' | 'age_warning' | 'not_checked_in';

export async function listRegistrations(userId: string, tournamentId: string, filter: RegistrationFilter = 'all', q = '') {
  const t = await requireTournament(userId, tournamentId);
  const conds = [eq(registrations.tournamentId, t.id), ne(registrations.status, 'cancelled')];
  if (filter === 'pending') conds.push(eq(registrations.status, 'pending'));
  if (filter === 'unpaid') conds.push(inArray(registrations.paymentStatus, ['unpaid', 'partial']));
  if (filter === 'age_warning') conds.push(eq(registrations.ageVerified, false)); // BTC đã đánh dấu không hợp lệ
  if (filter === 'not_checked_in') conds.push(isNull(registrations.checkedInAt));
  const query = q.trim();
  if (query) {
    const digits = query.replace(/\D/g, '');
    const like = `%${query}%`;
    conds.push(
      or(
        ilike(athletes.fullName, like),
        ilike(athletes.nameNormalized, `%${normalizeName(query)}%`),
        ilike(registrations.code, like),
        ilike(registrations.transferRef, like),
        ...(digits.length >= 3 ? [ilike(athletes.phone, `%${digits.replace(/^0/, '')}%`)] : []),
      )!,
    );
  }
  const rows = await db
    .select({ reg: registrations, athlete: athletes })
    .from(registrations)
    .innerJoin(athletes, eq(athletes.id, registrations.athleteId))
    .where(and(...conds))
    .orderBy(desc(registrations.createdAt))
    .limit(500);
  const entries = rows.length
    ? await db
        .select({ registrationId: registrationEntries.registrationId, id: registrationEntries.id, status: registrationEntries.status, weighResult: registrationEntries.weighResult, category: categories })
        .from(registrationEntries)
        .innerJoin(categories, eq(categories.id, registrationEntries.categoryId))
        .where(and(inArray(registrationEntries.registrationId, rows.map((r) => r.reg.id)), eq(registrationEntries.status, 'active')))
        .orderBy(asc(categories.sortOrder))
    : [];
  return rows.map((r) => ({ ...r.reg, athlete: r.athlete, entries: entries.filter((e) => e.registrationId === r.reg.id) }));
}
export type RegistrationRow = Awaited<ReturnType<typeof listRegistrations>>[number];

async function requireRegistration(userId: string, registrationId: string) {
  const reg = await db.query.registrations.findFirst({ where: eq(registrations.id, registrationId) });
  if (!reg) throw notFound('Không tìm thấy đăng ký');
  await requireTournament(userId, reg.tournamentId);
  return reg;
}

async function audit(tournamentId: string, actorUserId: string, entityId: string, action: string, before: unknown, after: unknown) {
  await db.insert(auditLogs).values({ tournamentId, actorUserId, entity: 'registration', entityId, action, before, after });
}

export async function setRegistrationStatus(userId: string, registrationId: string, status: 'approved' | 'rejected' | 'pending') {
  const reg = await requireRegistration(userId, registrationId);
  await db.update(registrations).set({ status, updatedAt: new Date() }).where(eq(registrations.id, reg.id));
  await audit(reg.tournamentId, userId, reg.id, `registration.${status}`, { status: reg.status }, { status });
}

/** Hủy đăng ký (xóa khỏi danh sách). Các hạng chuyển 'withdrawn'; tiền đã thu giữ nguyên để BTC tự hoàn. */
export async function cancelRegistration(userId: string, registrationId: string) {
  const reg = await requireRegistration(userId, registrationId);
  await db.transaction(async (tx) => {
    await tx.update(registrations).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(registrations.id, reg.id));
    await tx
      .update(registrationEntries)
      .set({ status: 'withdrawn' })
      .where(and(eq(registrationEntries.registrationId, reg.id), eq(registrationEntries.status, 'active')));
  });
  await audit(reg.tournamentId, userId, reg.id, 'registration.cancel', { status: reg.status }, { status: 'cancelled' });
}

export const athleteEditInput = z.object({
  fullName: z.string().trim().min(2).max(80),
  phone: z.string().transform((v, ctx) => normalizePhone(v) ?? (ctx.addIssue({ code: 'custom', message: 'Số điện thoại không hợp lệ' }), z.NEVER)),
  birthYear: z.coerce.number().int().min(1930).max(2030),
  club: z.string().trim().max(80).optional().transform((v) => v || null),
  note: z.string().trim().max(500).optional().transform((v) => v || null),
});

export async function editRegistration(userId: string, registrationId: string, raw: unknown) {
  const reg = await requireRegistration(userId, registrationId);
  const v = athleteEditInput.parse(raw);
  const before = await db.query.athletes.findFirst({ where: eq(athletes.id, reg.athleteId) });
  const fullName = cleanFullName(v.fullName);
  await db
    .update(athletes)
    .set({ fullName, nameNormalized: normalizeName(fullName), phone: v.phone, birthYear: v.birthYear, club: v.club, updatedAt: new Date() })
    .where(eq(athletes.id, reg.athleteId));
  await db.update(registrations).set({ note: v.note, updatedAt: new Date() }).where(eq(registrations.id, reg.id));
  await audit(reg.tournamentId, userId, reg.id, 'registration.edit', before, v);
}

/** BTC ghi nhận tiền (tiền mặt tại sân hoặc xác nhận chuyển khoản tay). */
export async function recordPayment(userId: string, registrationId: string, raw: unknown) {
  const reg = await requireRegistration(userId, registrationId);
  const v = z
    .object({ amount: z.coerce.number().int().positive('Số tiền phải lớn hơn 0').max(100_000_000), method: z.enum(['cash', 'manual']) })
    .parse(raw);
  return db.transaction((tx) =>
    applyPayment(tx, { registrationId: reg.id, tournamentId: reg.tournamentId, amount: v.amount, method: v.method, receivedAt: new Date(), recordedBy: userId }),
  );
}

export async function listUnmatchedPayments(userId: string, tournamentId: string) {
  const t = await requireTournament(userId, tournamentId);
  return db
    .select()
    .from(payments)
    .where(and(eq(payments.tournamentId, t.id), eq(payments.matchStatus, 'unmatched')))
    .orderBy(desc(payments.receivedAt));
}

/** Ghép tay một giao dịch ngân hàng không khớp vào một đăng ký. */
export async function matchPayment(userId: string, paymentId: string, registrationId: string) {
  const reg = await requireRegistration(userId, registrationId);
  await db.transaction(async (tx) => {
    const [p] = await tx.select().from(payments).where(eq(payments.id, paymentId)).for('update');
    if (!p || p.tournamentId !== reg.tournamentId || p.matchStatus !== 'unmatched') throw new AppError('INVALID', 'Giao dịch không còn chờ ghép');
    const [r] = await tx.select().from(registrations).where(eq(registrations.id, reg.id)).for('update');
    const amountPaid = r!.amountPaid + p.amount;
    await tx.update(payments).set({ registrationId: reg.id, matchStatus: 'matched', recordedBy: userId }).where(eq(payments.id, p.id));
    await tx
      .update(registrations)
      .set({ amountPaid, paymentStatus: paymentStatusOf(r!.amountDue, amountPaid), updatedAt: new Date() })
      .where(eq(registrations.id, reg.id));
    await tx.insert(auditLogs).values({
      tournamentId: reg.tournamentId, actorUserId: userId, entity: 'payment', entityId: p.id, action: 'payment.match',
      before: { amountPaid: r!.amountPaid }, after: { amountPaid, registrationId: reg.id },
    });
  });
}

export async function ignorePayment(userId: string, paymentId: string) {
  const p = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
  if (!p) throw notFound();
  await requireTournament(userId, p.tournamentId);
  await db.update(payments).set({ matchStatus: 'ignored', recordedBy: userId }).where(and(eq(payments.id, p.id), eq(payments.matchStatus, 'unmatched')));
}

export async function getDashboardStats(userId: string, tournamentId: string) {
  const t = await requireTournament(userId, tournamentId);
  const [row] = await db
    .select({
      athletes: sql<number>`count(*)::int`,
      pending: sql<number>`count(*) filter (where ${registrations.status} = 'pending')::int`,
      unpaid: sql<number>`count(*) filter (where ${registrations.paymentStatus} in ('unpaid','partial'))::int`,
      ageWarning: sql<number>`count(*) filter (where ${registrations.ageVerified} = false)::int`, // BTC đánh dấu năm sinh không hợp lệ
      checkedIn: sql<number>`count(*) filter (where ${registrations.checkedInAt} is not null)::int`,
      due: sql<number>`coalesce(sum(${registrations.amountDue}),0)::bigint`,
      paid: sql<number>`coalesce(sum(${registrations.amountPaid}),0)::bigint`,
    })
    .from(registrations)
    .where(and(eq(registrations.tournamentId, t.id), ne(registrations.status, 'cancelled')));
  const [entries] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(registrationEntries)
    .innerJoin(registrations, eq(registrations.id, registrationEntries.registrationId))
    .where(and(eq(registrations.tournamentId, t.id), eq(registrationEntries.status, 'active'), ne(registrations.status, 'cancelled')));
  const [unmatched] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(payments)
    .where(and(eq(payments.tournamentId, t.id), eq(payments.matchStatus, 'unmatched')));
  return { ...row!, due: Number(row!.due), paid: Number(row!.paid), entries: entries?.n ?? 0, unmatched: unmatched?.n ?? 0, capacity: t.capacity };
}
