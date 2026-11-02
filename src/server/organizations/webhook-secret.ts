import { createHash, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { organizations } from '@/db/schema';
import { requireOrgRole } from './service';

export const hashSecret = (s: string) => createHash('sha256').update(s).digest('hex');

/**
 * Tạo (hoặc đổi) API key để BTC dán vào cấu hình webhook SePay. Key cũ hết hiệu lực ngay.
 * DB chỉ lưu SHA-256; key gốc chỉ hiện cho BTC đúng một lần.
 */
export async function rotateWebhookSecret(userId: string, orgId: string): Promise<string> {
  await requireOrgRole(userId, orgId, ['owner']);
  const secret = randomBytes(24).toString('base64url');
  await db.update(organizations).set({ webhookSecret: hashSecret(secret), paymentProvider: 'sepay', updatedAt: new Date() }).where(eq(organizations.id, orgId));
  return secret;
}
