/** Thành viên BTC: mời bằng link (gửi qua Zalo), nhận lời mời, danh sách, gỡ thành viên. */
import { and, asc, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { db } from '@/db';
import { auditLogs, organizationInvites, organizationMembers, organizations, users } from '@/db/schema';
import { AppError } from '../shared/errors';
import { requireOrgRole } from './service';

const INVITE_DAYS = 7;
const hash = (t: string) => createHash('sha256').update(t).digest('hex');

export const inviteInput = z.object({
  role: z.enum(['staff', 'owner']).default('staff'),
  note: z.string().trim().max(80).optional().transform((v) => v || null),
});

/** Tạo link mời (token chỉ trả về một lần). Chỉ chủ BTC. */
export async function createInvite(userId: string, orgId: string, raw: unknown) {
  await requireOrgRole(userId, orgId, ['owner']);
  const v = inviteInput.parse(raw);
  const token = randomBytes(18).toString('base64url');
  const [inv] = await db
    .insert(organizationInvites)
    .values({ organizationId: orgId, tokenHash: hash(token), role: v.role, note: v.note, createdBy: userId, expiresAt: new Date(Date.now() + INVITE_DAYS * 86400_000) })
    .returning();
  return { invite: inv!, token };
}

/** Xem lời mời còn hiệu lực (cho trang nhận lời mời, chưa cần đăng nhập). */
export async function peekInvite(token: string) {
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(token)) return null;
  const [row] = await db
    .select({ invite: organizationInvites, orgName: organizations.name })
    .from(organizationInvites)
    .innerJoin(organizations, eq(organizations.id, organizationInvites.organizationId))
    .where(eq(organizationInvites.tokenHash, hash(token)));
  if (!row) return null;
  const i = row.invite;
  const state = i.revokedAt ? 'revoked' : i.usedAt ? 'used' : i.expiresAt < new Date() ? 'expired' : 'valid';
  return { organizationId: i.organizationId, orgName: row.orgName, role: i.role, state } as const;
}

/** Người dùng đã đăng nhập nhận lời mời → thành viên BTC. Mỗi link dùng một lần. */
export async function acceptInvite(userId: string, token: string) {
  const info = await peekInvite(token);
  if (!info) throw new AppError('NOT_FOUND', 'Link mời không tồn tại');
  if (info.state !== 'valid') throw new AppError('INVALID', info.state === 'expired' ? 'Link mời đã hết hạn' : 'Link mời đã được dùng hoặc đã bị thu hồi');
  return db.transaction(async (tx) => {
    const [inv] = await tx
      .update(organizationInvites)
      .set({ usedAt: new Date(), usedBy: userId })
      .where(and(eq(organizationInvites.tokenHash, hash(token)), isNull(organizationInvites.usedAt), isNull(organizationInvites.revokedAt), gt(organizationInvites.expiresAt, new Date())))
      .returning();
    if (!inv) throw new AppError('CONFLICT', 'Link mời vừa được dùng');
    const [existing] = await tx
      .select()
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, inv.organizationId), eq(organizationMembers.userId, userId)));
    if (!existing) await tx.insert(organizationMembers).values({ organizationId: inv.organizationId, userId, role: inv.role });
    else if (inv.role === 'owner' && existing.role !== 'owner')
      await tx.update(organizationMembers).set({ role: 'owner' }).where(and(eq(organizationMembers.organizationId, inv.organizationId), eq(organizationMembers.userId, userId)));
    await tx.insert(auditLogs).values({ actorUserId: userId, entity: 'organization', entityId: inv.organizationId, action: 'member.join', before: null, after: { role: inv.role } });
    return inv.organizationId;
  });
}

export async function listMembers(userId: string, orgId: string) {
  const myRole = await requireOrgRole(userId, orgId);
  const members = await db
    .select({ userId: users.id, email: users.email, fullName: users.fullName, role: organizationMembers.role, joinedAt: organizationMembers.createdAt })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(eq(organizationMembers.organizationId, orgId))
    .orderBy(asc(organizationMembers.createdAt));
  const invites =
    myRole === 'owner'
      ? await db
          .select()
          .from(organizationInvites)
          .where(and(eq(organizationInvites.organizationId, orgId), isNull(organizationInvites.usedAt), isNull(organizationInvites.revokedAt), gt(organizationInvites.expiresAt, new Date())))
          .orderBy(desc(organizationInvites.createdAt))
      : [];
  return { myRole, members, invites };
}

export async function revokeInvite(userId: string, orgId: string, inviteId: string) {
  await requireOrgRole(userId, orgId, ['owner']);
  await db
    .update(organizationInvites)
    .set({ revokedAt: new Date() })
    .where(and(eq(organizationInvites.id, inviteId), eq(organizationInvites.organizationId, orgId)));
}

/** Gỡ thành viên (chủ BTC gỡ người khác, hoặc tự rời). Luôn còn ít nhất một chủ. */
export async function removeMember(userId: string, orgId: string, memberUserId: string) {
  const myRole = await requireOrgRole(userId, orgId);
  if (memberUserId !== userId && myRole !== 'owner') throw new AppError('FORBIDDEN', 'Chỉ chủ BTC mới gỡ được thành viên khác');
  await db.transaction(async (tx) => {
    const [target] = await tx
      .select()
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.userId, memberUserId)));
    if (!target) throw new AppError('NOT_FOUND', 'Không tìm thấy thành viên');
    if (target.role === 'owner') {
      const [{ n }] = (await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(organizationMembers)
        .where(and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.role, 'owner')))) as [{ n: number }];
      if (n <= 1) throw new AppError('INVALID', 'BTC phải còn ít nhất một chủ');
    }
    await tx.delete(organizationMembers).where(and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.userId, memberUserId)));
    await tx.insert(auditLogs).values({ actorUserId: userId, entity: 'organization', entityId: orgId, action: 'member.remove', before: { userId: memberUserId, role: target.role }, after: null });
  });
}
