/** Thông báo cho VĐV: dời lịch, gửi hàng loạt. Kênh MVP: banner trên trang, văn bản copy vào Zalo, email (nếu có). */
import { and, desc, eq, isNotNull, ne } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { athletes, auditLogs, notifications, registrations, tournaments } from '@/db/schema';
import { emailEnabled, sendEmails } from '@/lib/email';
import { parseVnLocal, formatDateTime } from '../shared/time';
import { AppError } from '../shared/errors';
import { requireTournament } from '../tournaments/service';

async function recipients(tournamentId: string) {
  return db
    .select({ email: athletes.email, token: registrations.ticketToken })
    .from(registrations)
    .innerJoin(athletes, eq(athletes.id, registrations.athleteId))
    .where(and(eq(registrations.tournamentId, tournamentId), ne(registrations.status, 'cancelled'), isNotNull(athletes.email)));
}

async function deliver(t: typeof tournaments.$inferSelect, userId: string, kind: 'postpone' | 'broadcast', title: string, body: string, withEmail: boolean) {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  let emailed = 0;
  if (withEmail && emailEnabled()) {
    const list = await recipients(t.id);
    emailed = await sendEmails(
      list.map((r) => ({ to: r.email!, subject: `[${t.name}] ${title}`, text: `${body}\n\nVé của bạn: ${site}/ve/${r.token}\nTrang giải: ${site}/${t.slug}` })),
    );
  }
  const [n] = await db
    .insert(notifications)
    .values({
      tournamentId: t.id,
      kind,
      channels: ['page_banner', 'zalo_copy', ...(emailed > 0 ? (['email'] as const) : [])],
      title,
      body,
      recipientsCount: emailed,
      sentAt: new Date(),
      createdBy: userId,
    })
    .returning();
  const zaloText = `📢 ${t.name.toUpperCase()}\n${title}\n\n${body}\n\n👉 ${site}/${t.slug}`;
  return { notification: n!, emailed, zaloText };
}

export const postponeInput = z.object({
  startsAt: z.string().transform((v, ctx) => parseVnLocal(v) ?? (ctx.addIssue({ code: 'custom', message: 'Thời gian không hợp lệ' }), z.NEVER)),
  message: z.string().trim().max(1000).optional().default(''),
  email: z.boolean().default(true),
});

/** Dời lịch giải và tự thông báo cho mọi VĐV đã đăng ký. */
export async function postponeTournament(userId: string, tournamentId: string, raw: unknown) {
  const t = await requireTournament(userId, tournamentId);
  const v = postponeInput.parse(raw);
  if (!t.startsAt) throw new AppError('INVALID', 'Giải chưa có thời gian để dời');
  const shift = v.startsAt.getTime() - t.startsAt.getTime();
  const moveDeadline = t.registrationDeadline && shift > 0;
  const [updated] = await db
    .update(tournaments)
    .set({
      startsAt: v.startsAt,
      endsAt: t.endsAt ? new Date(t.endsAt.getTime() + shift) : null,
      registrationDeadline: moveDeadline ? new Date(t.registrationDeadline!.getTime() + shift) : t.registrationDeadline,
      updatedAt: new Date(),
    })
    .where(eq(tournaments.id, t.id))
    .returning();
  await db.insert(auditLogs).values({
    tournamentId: t.id, actorUserId: userId, entity: 'tournament', entityId: t.id, action: 'tournament.postpone',
    before: { startsAt: t.startsAt }, after: { startsAt: v.startsAt },
  });
  const title = `Dời lịch thi đấu sang ${formatDateTime(v.startsAt)}`;
  const body = [`Giải được dời từ ${formatDateTime(t.startsAt)} sang ${formatDateTime(v.startsAt)}.`, v.message].filter(Boolean).join('\n');
  return deliver(updated!, userId, 'postpone', title, body, v.email);
}

export const broadcastInput = z.object({
  title: z.string().trim().min(3, 'Tiêu đề quá ngắn').max(120),
  body: z.string().trim().min(3, 'Nội dung quá ngắn').max(3000),
  email: z.boolean().default(true),
});

export async function broadcast(userId: string, tournamentId: string, raw: unknown) {
  const t = await requireTournament(userId, tournamentId);
  const v = broadcastInput.parse(raw);
  return deliver(t, userId, 'broadcast', v.title, v.body, v.email);
}

export async function listNotifications(userId: string, tournamentId: string) {
  const t = await requireTournament(userId, tournamentId);
  return db.select().from(notifications).where(eq(notifications.tournamentId, t.id)).orderBy(desc(notifications.createdAt));
}

/** Thông báo mới nhất để hiện banner trên trang giải / trang vé (trong 30 ngày). */
export async function getLatestBanner(tournamentId: string) {
  const [n] = await db.select().from(notifications).where(eq(notifications.tournamentId, tournamentId)).orderBy(desc(notifications.createdAt)).limit(1);
  if (!n || !n.sentAt || Date.now() - n.sentAt.getTime() > 30 * 86400_000) return null;
  return { title: n.title, body: n.body, sentAt: n.sentAt };
}

export { emailEnabled };
