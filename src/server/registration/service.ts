/** Đăng ký thi đấu: VĐV không cần tài khoản, nhiều hạng một lần, đăng ký thêm cập nhật vào bản cũ. */
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import {
  athletes,
  auditLogs,
  categories,
  organizations,
  payments,
  priceTiers,
  registrationEntries,
  registrations,
  tournaments,
} from '@/db/schema';
import { AppError, notFound } from '../shared/errors';
import { additionalFee, paymentStatusOf, pickPriceTier, type FeeEntry } from './fees';
import {
  allocateFees,
  cleanFullName,
  genderFits,
  isOutsideBirthYears,
  newTicketToken,
  newTransferRef,
  normalizeName,
  normalizePhone,
} from './rules';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const registerInput = z.object({
  fullName: z.string().trim().min(2, 'Nhập họ tên').max(80),
  phone: z
    .string()
    .transform((v, ctx) => {
      const p = normalizePhone(v);
      if (!p) {
        ctx.addIssue({ code: 'custom', message: 'Số điện thoại không hợp lệ' });
        return z.NEVER;
      }
      return p;
    }),
  email: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || z.email().safeParse(v).success, 'Email không hợp lệ'),
  birthYear: z.coerce.number().int().min(1930, 'Năm sinh không hợp lệ').max(new Date().getFullYear() - 5, 'Năm sinh không hợp lệ'),
  gender: z.enum(['male', 'female']),
  club: z.string().trim().max(80).optional().transform((v) => v || null),
  categoryIds: z.array(z.uuid()).min(1, 'Chọn ít nhất một hạng mục').max(10),
  consent: z.literal(true, { message: 'Cần đồng ý để BTC xử lý thông tin đăng ký' }),
});
export type RegisterInput = z.input<typeof registerInput>;

export interface RegisterOptions {
  source: 'online' | 'onsite';
  actorUserId?: string; // BTC thêm tại sân
  now?: Date;
}

/**
 * Đăng ký (hoặc đăng ký thêm). Trong transaction: khóa dòng giải để không vượt số suất,
 * tính phí theo đợt giá hiện tại, chốt `fee` từng hạng, tính lại amountDue/paymentStatus.
 */
export async function register(tournamentId: string, raw: unknown, opts: RegisterOptions) {
  const v = registerInput.parse(raw);
  const now = opts.now ?? new Date();

  return db.transaction(async (tx) => {
    const [t] = await tx.select().from(tournaments).where(eq(tournaments.id, tournamentId)).for('update');
    if (!t) throw notFound('Không tìm thấy giải');
    if (opts.source === 'online') {
      if (t.status !== 'published') throw new AppError('INVALID', 'Giải chưa mở hoặc đã đóng đăng ký');
      if (t.registrationDeadline && t.registrationDeadline < now) throw new AppError('INVALID', 'Đã hết hạn đăng ký online');
    } else if (t.status === 'draft' || t.status === 'cancelled') {
      throw new AppError('INVALID', 'Giải chưa xuất bản hoặc đã hủy');
    }

    const cats = await tx
      .select()
      .from(categories)
      .where(and(eq(categories.tournamentId, t.id), inArray(categories.id, v.categoryIds)));
    if (cats.length !== new Set(v.categoryIds).size) throw new AppError('INVALID', 'Hạng mục không hợp lệ');
    for (const c of cats) {
      if (c.kind !== 'weight') throw new AppError('INVALID', `Không đăng ký trực tiếp được hạng ${c.label}`);
      if (!genderFits(v.gender, c.gender)) throw new AppError('INVALID', `Hạng ${c.label} không dành cho giới tính đã chọn`);
    }

    // VĐV: nhận diện theo SĐT + tên
    const athlete = await upsertAthlete(tx, v);

    const [existing] = await tx
      .select()
      .from(registrations)
      .where(and(eq(registrations.tournamentId, t.id), eq(registrations.athleteId, athlete.id)));
    const activeEntries = existing
      ? await tx
          .select({ categoryId: registrationEntries.categoryId, fee: registrationEntries.fee, hand: categories.hand, autoAdded: registrationEntries.autoAdded })
          .from(registrationEntries)
          .innerJoin(categories, eq(categories.id, registrationEntries.categoryId))
          .where(and(eq(registrationEntries.registrationId, existing.id), eq(registrationEntries.status, 'active')))
      : [];
    const already = new Set(activeEntries.map((e) => e.categoryId));
    const added = cats.filter((c) => !already.has(c.id));
    if (existing && existing.status !== 'cancelled' && added.length === 0) {
      return { registration: existing, created: false, addedCount: 0 };
    }

    // Số suất: giải (theo số VĐV) và từng hạng (theo số entry)
    if (!existing || existing.status === 'cancelled') {
      if (t.capacity !== null) {
        const [{ n }] = (await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(registrations)
          .where(and(eq(registrations.tournamentId, t.id), ne(registrations.status, 'cancelled')))) as [{ n: number }];
        if (n >= t.capacity && opts.source === 'online') throw new AppError('CONFLICT', 'Giải đã đủ số suất');
      }
    }
    for (const c of added.filter((x) => x.capacity !== null)) {
      const [{ n }] = (await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(registrationEntries)
        .where(and(eq(registrationEntries.categoryId, c.id), eq(registrationEntries.status, 'active')))) as [{ n: number }];
      if (n >= c.capacity! && opts.source === 'online') throw new AppError('CONFLICT', `Hạng ${c.label} đã đủ suất`);
    }

    // Phí theo đợt giá hiện tại
    const tiers = await tx.select().from(priceTiers).where(eq(priceTiers.tournamentId, t.id)).orderBy(asc(priceTiers.sortOrder));
    const tier = pickPriceTier(tiers, opts.source, now) ?? pickPriceTier(tiers, opts.source === 'online' ? 'onsite' : 'online', now);
    if (!tier) throw new AppError('INVALID', 'Giải chưa có lệ phí cho hình thức đăng ký này');
    const existingFee = activeEntries.reduce((s, e) => s + e.fee, 0);
    const extra = additionalFee(
      activeEntries.map<FeeEntry>((e) => ({ hand: e.hand, autoAdded: e.autoAdded })),
      added.map<FeeEntry>((c) => ({ hand: c.hand })),
      existingFee,
      tier,
    );
    const fees = allocateFees(added.length, extra, tier.singleHandPrice);
    const ageWarning = cats.some((c) => isOutsideBirthYears(v.birthYear, c, t)) || !!existing?.ageWarning;

    let reg: typeof registrations.$inferSelect;
    if (existing) {
      const amountDue = existing.status === 'cancelled' ? extra : existing.amountDue + extra;
      [reg] = (await tx
        .update(registrations)
        .set({
          status: existing.status === 'cancelled' ? 'pending' : existing.status,
          amountDue,
          paymentStatus: paymentStatusOf(amountDue, existing.amountPaid),
          ageWarning,
          updatedAt: now,
        })
        .where(eq(registrations.id, existing.id))
        .returning()) as [typeof registrations.$inferSelect];
    } else {
      const [{ seq }] = (await tx
        .update(tournaments)
        .set({ registrationSeq: sql`${tournaments.registrationSeq} + 1` })
        .where(eq(tournaments.id, t.id))
        .returning({ seq: tournaments.registrationSeq })) as [{ seq: number }];
      reg = await insertRegistration(tx, {
        tournamentId: t.id,
        athleteId: athlete.id,
        code: `${t.codePrefix}-${String(seq).padStart(4, '0')}`,
        source: opts.source,
        priceTierId: tier.id,
        amountDue: extra,
        amountPaid: 0,
        paymentStatus: paymentStatusOf(extra, 0),
        ageWarning,
        consentAt: now,
        status: opts.source === 'onsite' ? 'approved' : 'pending',
      });
    }

    if (added.length) {
      await tx.insert(registrationEntries).values(
        added.map((c, i) => ({ registrationId: reg.id, categoryId: c.id, athleteId: athlete.id, fee: fees[i]!, priceTierId: tier.id })),
      );
    }
    if (existing) {
      await tx.insert(auditLogs).values({
        tournamentId: t.id,
        actorUserId: opts.actorUserId ?? null,
        entity: 'registration',
        entityId: reg.id,
        action: 'registration.add_entry',
        before: { amountDue: existing.amountDue, categories: [...already] },
        after: { amountDue: reg.amountDue, added: added.map((c) => c.id) },
      });
    }
    return { registration: reg, created: !existing, addedCount: added.length };
  });
}

async function upsertAthlete(tx: Tx, v: z.output<typeof registerInput>) {
  const fullName = cleanFullName(v.fullName);
  const [a] = await tx
    .insert(athletes)
    .values({ fullName, nameNormalized: normalizeName(fullName), phone: v.phone, email: v.email, birthYear: v.birthYear, gender: v.gender, club: v.club })
    .onConflictDoUpdate({
      target: [athletes.phone, athletes.nameNormalized],
      set: {
        fullName,
        birthYear: v.birthYear,
        gender: v.gender,
        club: sql`coalesce(excluded.club, ${athletes.club})`,
        email: sql`coalesce(excluded.email, ${athletes.email})`,
        updatedAt: new Date(),
      },
    })
    .returning();
  return a!;
}

async function insertRegistration(
  tx: Tx,
  values: Omit<typeof registrations.$inferInsert, 'transferRef' | 'ticketToken'>,
): Promise<typeof registrations.$inferSelect> {
  // Mã CK ngẫu nhiên 6 ký tự (~1 tỷ tổ hợp); va chạm cực hiếm thì thử lại.
  for (let attempt = 0; attempt < 5; attempt++) {
    const transferRef = newTransferRef();
    const clash = await tx.select({ id: registrations.id }).from(registrations).where(eq(registrations.transferRef, transferRef));
    if (clash.length) continue;
    const [r] = await tx.insert(registrations).values({ ...values, transferRef, ticketToken: newTicketToken() }).returning();
    return r!;
  }
  throw new Error('Không sinh được mã chuyển khoản');
}

/* ───────────── Vé (link riêng của VĐV) ───────────── */

export async function getTicket(token: string) {
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) return null;
  const [row] = await db
    .select({ reg: registrations, athlete: athletes, t: tournaments, org: organizations })
    .from(registrations)
    .innerJoin(athletes, eq(athletes.id, registrations.athleteId))
    .innerJoin(tournaments, eq(tournaments.id, registrations.tournamentId))
    .innerJoin(organizations, eq(organizations.id, tournaments.organizationId))
    .where(eq(registrations.ticketToken, token));
  if (!row) return null;
  const entries = await db
    .select({ id: registrationEntries.id, status: registrationEntries.status, fee: registrationEntries.fee, weighResult: registrationEntries.weighResult, category: categories })
    .from(registrationEntries)
    .innerJoin(categories, eq(categories.id, registrationEntries.categoryId))
    .where(eq(registrationEntries.registrationId, row.reg.id))
    .orderBy(asc(categories.sortOrder));
  return {
    registration: row.reg,
    athlete: row.athlete,
    tournament: row.t,
    bank: { bin: row.org.bankBin, accountNo: row.org.bankAccountNo, accountName: row.org.bankAccountName, organizationName: row.org.name },
    entries: entries.filter((e) => e.status === 'active' || e.status === 'disqualified'),
  };
}
export type Ticket = NonNullable<Awaited<ReturnType<typeof getTicket>>>;

/** Trạng thái thanh toán gọn để trang vé hỏi định kỳ. */
export async function getPaymentState(token: string) {
  const [r] = await db
    .select({ amountDue: registrations.amountDue, amountPaid: registrations.amountPaid, paymentStatus: registrations.paymentStatus })
    .from(registrations)
    .where(eq(registrations.ticketToken, token));
  return r ?? null;
}

/* ───────────── Ghi nhận tiền ───────────── */

/**
 * Ghi một khoản tiền vào đăng ký và tính lại trạng thái. Dùng chung cho webhook ngân hàng,
 * tiền mặt tại sân và BTC xác nhận tay.
 */
export async function applyPayment(
  tx: Tx,
  p: {
    registrationId: string;
    tournamentId: string;
    amount: number;
    method: 'vietqr' | 'cash' | 'manual';
    provider?: 'none' | 'sepay' | 'casso';
    providerTxnId?: string | null;
    transferContent?: string | null;
    receivedAt: Date;
    recordedBy?: string | null;
    raw?: unknown;
  },
) {
  const [reg] = await tx.select().from(registrations).where(eq(registrations.id, p.registrationId)).for('update');
  if (!reg) throw notFound('Không tìm thấy đăng ký');
  await tx.insert(payments).values({
    tournamentId: p.tournamentId,
    registrationId: reg.id,
    method: p.method,
    provider: p.provider ?? 'none',
    providerTxnId: p.providerTxnId ?? null,
    amount: p.amount,
    transferContent: p.transferContent ?? null,
    matchStatus: 'matched',
    receivedAt: p.receivedAt,
    recordedBy: p.recordedBy ?? null,
    raw: p.raw ?? null,
  });
  const amountPaid = reg.amountPaid + p.amount;
  const [updated] = await tx
    .update(registrations)
    .set({ amountPaid, paymentStatus: paymentStatusOf(reg.amountDue, amountPaid), updatedAt: new Date() })
    .where(eq(registrations.id, reg.id))
    .returning();
  await tx.insert(auditLogs).values({
    tournamentId: p.tournamentId,
    actorUserId: p.recordedBy ?? null,
    entity: 'payment',
    entityId: reg.id,
    action: `payment.${p.method}`,
    before: { amountPaid: reg.amountPaid },
    after: { amountPaid, amount: p.amount },
  });
  return updated!;
}
