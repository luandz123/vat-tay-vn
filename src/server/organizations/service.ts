/** Ban tổ chức (organization): tạo, sửa, kiểm tra quyền thành viên. */
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { organizationMembers, organizations } from '@/db/schema';
import { BANKS } from '../shared/banks';
import { AppError, forbidden } from '../shared/errors';

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);

export const organizationInput = z
  .object({
    name: z.string().trim().min(2, 'Tên BTC tối thiểu 2 ký tự').max(120),
    phone: optionalText(20),
    zalo: optionalText(200),
    facebook: optionalText(300),
    tiktok: optionalText(300),
    bankBin: z
      .string()
      .optional()
      .transform((v) => v || null)
      .refine((v) => v === null || BANKS.some((b) => b.bin === v), 'Ngân hàng không hợp lệ'),
    bankAccountNo: z
      .string()
      .trim()
      .optional()
      .transform((v) => v?.replace(/\s+/g, '') || null)
      .refine((v) => v === null || /^[0-9A-Za-z]{4,32}$/.test(v), 'Số tài khoản không hợp lệ'),
    bankAccountName: z
      .string()
      .trim()
      .max(100)
      .optional()
      .transform((v) => v?.toUpperCase() || null),
  })
  .refine((v) => (v.bankBin === null) === (v.bankAccountNo === null), {
    message: 'Cần nhập đủ cả ngân hàng và số tài khoản',
    path: ['bankAccountNo'],
  });

export type OrganizationInput = z.input<typeof organizationInput>;
export type Organization = typeof organizations.$inferSelect;

function toRow(v: z.output<typeof organizationInput>) {
  return {
    name: v.name,
    contacts: {
      ...(v.phone && { phone: v.phone }),
      ...(v.zalo && { zalo: v.zalo }),
      ...(v.facebook && { facebook: v.facebook }),
      ...(v.tiktok && { tiktok: v.tiktok }),
    },
    bankBin: v.bankBin,
    bankAccountNo: v.bankAccountNo,
    bankAccountName: v.bankAccountName,
  };
}

export async function createOrganization(userId: string, raw: unknown): Promise<Organization> {
  const input = organizationInput.parse(raw);
  return db.transaction(async (tx) => {
    const [org] = await tx.insert(organizations).values(toRow(input)).returning();
    await tx.insert(organizationMembers).values({ organizationId: org!.id, userId, role: 'owner' });
    return org!;
  });
}

export async function updateOrganization(userId: string, orgId: string, raw: unknown): Promise<Organization> {
  await requireOrgRole(userId, orgId, ['owner']);
  const input = organizationInput.parse(raw);
  const [org] = await db
    .update(organizations)
    .set({ ...toRow(input), updatedAt: new Date() })
    .where(eq(organizations.id, orgId))
    .returning();
  return org!;
}

export async function listMyOrganizations(userId: string) {
  const rows = await db
    .select({ org: organizations, role: organizationMembers.role })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
    .where(eq(organizationMembers.userId, userId))
    .orderBy(organizations.createdAt);
  return rows.map((r) => ({ ...r.org, role: r.role }));
}

/** Ném FORBIDDEN nếu người dùng không thuộc BTC (hoặc không đủ vai trò). */
export async function requireOrgRole(
  userId: string,
  orgId: string,
  roles: ('owner' | 'staff')[] = ['owner', 'staff'],
): Promise<'owner' | 'staff'> {
  const [m] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.userId, userId),
        inArray(organizationMembers.role, roles),
      ),
    )
    .limit(1);
  if (!m) throw forbidden();
  return m.role;
}

export async function getOrganization(userId: string, orgId: string): Promise<Organization> {
  await requireOrgRole(userId, orgId);
  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, orgId) });
  if (!org) throw new AppError('NOT_FOUND', 'Không tìm thấy BTC');
  return org;
}
