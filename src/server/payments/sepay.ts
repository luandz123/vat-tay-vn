/**
 * Webhook SePay: mỗi BTC tự kết nối tài khoản ngân hàng của mình với SePay và trỏ webhook về
 * /api/webhooks/sepay/<organizationId>, xác thực bằng "Authorization: Apikey <webhookSecret>".
 */
import { and, desc, eq, inArray } from 'drizzle-orm';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { db } from '@/db';
import { organizations, payments, registrations, tournaments } from '@/db/schema';
import { hashSecret } from '../organizations/webhook-secret';
import { applyPayment } from '../registration/service';
import { findTransferRef } from '../registration/rules';

export const sepayPayload = z.object({
  id: z.union([z.number(), z.string()]).transform(String),
  gateway: z.string().optional(),
  transactionDate: z.string(), // "2026-11-02 21:14:05" giờ VN
  accountNumber: z.string().optional().nullable(),
  code: z.string().optional().nullable(),
  content: z.string().default(''),
  transferType: z.enum(['in', 'out']),
  transferAmount: z.number().int().nonnegative(),
  referenceCode: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

export type WebhookResult =
  | { status: 'unauthorized' }
  | { status: 'ignored'; reason: string }
  | { status: 'duplicate' }
  | { status: 'matched'; registrationId: string; tournamentId: string; paymentStatus: string }
  | { status: 'unmatched'; tournamentId: string };

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

function parseVnTime(s: string): Date {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/.exec(s.trim());
  return m ? new Date(`${m[1]}T${m[2]}+07:00`) : new Date();
}

export async function handleSepayWebhook(organizationId: string, authorization: string | null, body: unknown): Promise<WebhookResult> {
  const org = /^[0-9a-f-]{36}$/i.test(organizationId)
    ? await db.query.organizations.findFirst({ where: eq(organizations.id, organizationId) })
    : undefined;
  const key = authorization?.replace(/^Apikey\s+/i, '').trim() ?? '';
  if (!org?.webhookSecret || !key || !safeEqual(hashSecret(key), org.webhookSecret)) return { status: 'unauthorized' };

  const parsed = sepayPayload.safeParse(body);
  if (!parsed.success) return { status: 'ignored', reason: 'payload' };
  const p = parsed.data;
  if (p.transferType !== 'in') return { status: 'ignored', reason: 'out' };
  if (org.bankAccountNo && p.accountNumber && p.accountNumber !== org.bankAccountNo) return { status: 'ignored', reason: 'account' };

  const ref = findTransferRef(`${p.code ?? ''} ${p.content} ${p.description ?? ''}`);
  const receivedAt = parseVnTime(p.transactionDate);

  return db.transaction(async (tx) => {
    const dup = await tx
      .select({ id: payments.id })
      .from(payments)
      .where(and(eq(payments.provider, 'sepay'), eq(payments.providerTxnId, p.id)));
    if (dup.length) return { status: 'duplicate' } as const;

    if (ref) {
      const [reg] = await tx
        .select({ id: registrations.id, tournamentId: registrations.tournamentId })
        .from(registrations)
        .innerJoin(tournaments, eq(tournaments.id, registrations.tournamentId))
        .where(and(eq(registrations.transferRef, ref), eq(tournaments.organizationId, org.id)));
      if (reg) {
        const updated = await applyPayment(tx, {
          registrationId: reg.id,
          tournamentId: reg.tournamentId,
          amount: p.transferAmount,
          method: 'vietqr',
          provider: 'sepay',
          providerTxnId: p.id,
          transferContent: p.content,
          receivedAt,
          raw: body,
        });
        return { status: 'matched', registrationId: reg.id, tournamentId: reg.tournamentId, paymentStatus: updated.paymentStatus } as const;
      }
    }

    // Không ghép được: lưu vào hàng chờ của giải đang mở gần nhất để BTC ghép tay.
    const [t] = await tx
      .select({ id: tournaments.id })
      .from(tournaments)
      .where(and(eq(tournaments.organizationId, org.id), inArray(tournaments.status, ['published', 'ongoing'])))
      .orderBy(desc(tournaments.startsAt))
      .limit(1);
    if (!t) return { status: 'ignored', reason: 'no-open-tournament' } as const;
    await tx.insert(payments).values({
      tournamentId: t.id,
      registrationId: null,
      method: 'vietqr',
      provider: 'sepay',
      providerTxnId: p.id,
      amount: p.transferAmount,
      transferContent: p.content,
      matchStatus: 'unmatched',
      receivedAt,
      raw: body,
    });
    return { status: 'unmatched', tournamentId: t.id } as const;
  });
}
