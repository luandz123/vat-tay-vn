'use server';

/** Server action của khu BTC: lớp mỏng gọi src/server, không chứa logic nghiệp vụ. */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { createUploadUrl, deleteObject } from '@/lib/storage';
import { createOrganization, updateOrganization } from '@/server/organizations/service';
import {
  createDraft,
  getTournamentForEdit,
  imageKeyFor,
  publishTournament,
  saveCategories,
  saveImages,
  savePricing,
  saveSchedule,
  updateInfo,
} from '@/server/tournaments/service';
import { toResult, type ActionResult } from '../_lib/action-result';

export async function createOrganizationAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return toResult(async () => {
    const user = await requireUser();
    const org = await createOrganization(user.id, raw);
    return { id: org.id };
  });
}

export async function updateOrganizationAction(orgId: string, raw: unknown): Promise<ActionResult> {
  return toResult(async () => {
    const user = await requireUser();
    await updateOrganization(user.id, orgId, raw);
    revalidatePath('/btc');
    return undefined;
  });
}

export async function createDraftAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return toResult(async () => {
    const user = await requireUser();
    const t = await createDraft(user.id, raw);
    return { id: t.id };
  });
}

const revalidateWizard = (id: string) => revalidatePath(`/btc/giai/${id}`, 'layout');

export async function updateInfoAction(id: string, raw: unknown): Promise<ActionResult> {
  return toResult(async () => {
    const user = await requireUser();
    await updateInfo(user.id, id, raw);
    revalidateWizard(id);
    return undefined;
  });
}

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const;

/** Tạo 2 URL upload một lần: ảnh gốc (poster) và ảnh đã cắt 1.91:1 cho chia sẻ. */
export async function createImageUploadsAction(
  id: string,
  coverType: string,
): Promise<ActionResult<{ cover: { uploadUrl: string; key: string }; og: { uploadUrl: string; key: string } }>> {
  return toResult(async () => {
    const user = await requireUser();
    await getTournamentForEdit(user.id, id); // kiểm tra quyền
    const ext = EXT[coverType as keyof typeof EXT];
    if (!ext) throw new Error('Định dạng ảnh không hỗ trợ');
    const [cover, og] = await Promise.all([createUploadUrl(imageKeyFor(id, 'cover', ext)), createUploadUrl(imageKeyFor(id, 'og', 'jpg'))]);
    return { cover: { uploadUrl: cover.uploadUrl, key: cover.key }, og: { uploadUrl: og.uploadUrl, key: og.key } };
  });
}

export async function saveImagesAction(id: string, keys: { coverKey: string; ogKey: string }): Promise<ActionResult> {
  return toResult(async () => {
    const user = await requireUser();
    const { previous } = await saveImages(user.id, id, keys);
    await Promise.allSettled(previous.map((k) => deleteObject(k)));
    revalidateWizard(id);
    return undefined;
  });
}

export async function saveCategoriesAction(id: string, raw: unknown): Promise<ActionResult> {
  return toResult(async () => {
    const user = await requireUser();
    await saveCategories(user.id, id, raw);
    revalidateWizard(id);
    return undefined;
  });
}

export async function savePricingAction(id: string, raw: unknown): Promise<ActionResult> {
  return toResult(async () => {
    const user = await requireUser();
    await savePricing(user.id, id, raw);
    revalidateWizard(id);
    return undefined;
  });
}

export async function saveScheduleAction(id: string, raw: unknown): Promise<ActionResult> {
  return toResult(async () => {
    const user = await requireUser();
    await saveSchedule(user.id, id, raw);
    revalidateWizard(id);
    return undefined;
  });
}

export async function publishAction(id: string): Promise<ActionResult<{ slug: string }>> {
  return toResult(async () => {
    const user = await requireUser();
    const t = await publishTournament(user.id, id);
    revalidateWizard(id);
    revalidatePath(`/${t.slug}`);
    return { slug: t.slug };
  });
}

export async function rotateWebhookSecretAction(orgId: string): Promise<ActionResult<{ secret: string }>> {
  return toResult(async () => {
    const user = await requireUser();
    const { rotateWebhookSecret } = await import('@/server/organizations/webhook-secret');
    return { secret: await rotateWebhookSecret(user.id, orgId) };
  });
}

export async function createInviteAction(orgId: string, raw: unknown): Promise<ActionResult<{ link: string }>> {
  return toResult(async () => {
    const user = await requireUser();
    const { createInvite } = await import('@/server/organizations/members');
    const { token } = await createInvite(user.id, orgId, raw);
    revalidatePath(`/btc/to-chuc/${orgId}/thanh-vien`);
    return { link: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/moi/${token}` };
  });
}

export async function revokeInviteAction(orgId: string, inviteId: string): Promise<ActionResult> {
  return toResult(async () => {
    const user = await requireUser();
    const { revokeInvite } = await import('@/server/organizations/members');
    await revokeInvite(user.id, orgId, inviteId);
    revalidatePath(`/btc/to-chuc/${orgId}/thanh-vien`);
    return undefined;
  });
}

export async function removeMemberAction(orgId: string, memberUserId: string): Promise<ActionResult> {
  return toResult(async () => {
    const user = await requireUser();
    const { removeMember } = await import('@/server/organizations/members');
    await removeMember(user.id, orgId, memberUserId);
    revalidatePath(`/btc/to-chuc/${orgId}/thanh-vien`);
    return undefined;
  });
}

export async function deleteTournamentAction(id: string, confirmSlug: string): Promise<ActionResult> {
  const r = await toResult(async () => {
    const user = await requireUser();
    const { deleteTournament } = await import('@/server/tournaments/service');
    const { slug, imageKeys } = await deleteTournament(user.id, id, confirmSlug);
    await Promise.allSettled(imageKeys.map((k) => deleteObject(k)));
    revalidatePath('/btc');
    revalidatePath(`/${slug}`, 'layout'); // trang giải được cache 60 giây
    return undefined;
  });
  // Chuyển trang ngay từ server: không render lại trang của giải vừa xóa
  if (r.ok) redirect('/btc');
  return r;
}
