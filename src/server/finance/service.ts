/** Báo cáo thu chi (tùy chọn, mặc định tắt). Thu = tổng tiền đã ghép vào đăng ký; chi = BTC tự nhập. */
import { and, asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { expenses, payments, tournaments } from '@/db/schema';
import { notFound } from '../shared/errors';
import { requireTournament } from '../tournaments/service';

async function summary(tournamentId: string) {
  const income = await db
    .select({ method: payments.method, total: sql<number>`coalesce(sum(${payments.amount}),0)::bigint`, n: sql<number>`count(*)::int` })
    .from(payments)
    .where(and(eq(payments.tournamentId, tournamentId), eq(payments.matchStatus, 'matched')))
    .groupBy(payments.method);
  const list = await db.select().from(expenses).where(eq(expenses.tournamentId, tournamentId)).orderBy(asc(expenses.createdAt));
  const totalIncome = income.reduce((s, r) => s + Number(r.total), 0);
  const totalExpense = list.reduce((s, e) => s + e.amount, 0);
  return {
    income: income.map((r) => ({ method: r.method, total: Number(r.total), count: r.n })),
    expenses: list,
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
  };
}

export async function getFinance(userId: string, tournamentId: string) {
  const t = await requireTournament(userId, tournamentId);
  return { visibility: t.financeVisibility, ...(await summary(t.id)) };
}

/** Bản công khai: chỉ khi BTC chọn 'public' (hoặc 'athletes' và người xem có vé). */
export async function getPublicFinance(tournamentId: string, viewerHasTicket: boolean) {
  const t = await db.query.tournaments.findFirst({ where: eq(tournaments.id, tournamentId) });
  if (!t) throw notFound();
  if (t.financeVisibility === 'public' || (t.financeVisibility === 'athletes' && viewerHasTicket)) return summary(t.id);
  return null;
}

export async function setFinanceVisibility(userId: string, tournamentId: string, visibility: unknown) {
  const t = await requireTournament(userId, tournamentId);
  const v = z.enum(['off', 'organizers', 'athletes', 'public']).parse(visibility);
  await db.update(tournaments).set({ financeVisibility: v, updatedAt: new Date() }).where(eq(tournaments.id, t.id));
}

export const expenseInput = z.object({
  title: z.string().trim().min(2, 'Nhập nội dung chi').max(120),
  amount: z.union([z.number(), z.string()]).transform((v, ctx) => {
    const n = Number(String(v).replace(/[.\s,đ]/g, ''));
    return Number.isInteger(n) && n > 0 && n <= 1_000_000_000 ? n : (ctx.addIssue({ code: 'custom', message: 'Số tiền không hợp lệ' }), z.NEVER);
  }),
});

export async function addExpense(userId: string, tournamentId: string, raw: unknown) {
  const t = await requireTournament(userId, tournamentId);
  const v = expenseInput.parse(raw);
  await db.insert(expenses).values({ tournamentId: t.id, title: v.title, amount: v.amount, createdBy: userId });
}

export async function deleteExpense(userId: string, tournamentId: string, expenseId: string) {
  const t = await requireTournament(userId, tournamentId);
  await db.delete(expenses).where(and(eq(expenses.id, expenseId), eq(expenses.tournamentId, t.id)));
}
