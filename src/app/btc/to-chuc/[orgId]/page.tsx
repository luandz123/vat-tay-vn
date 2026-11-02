import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { OrganizationForm } from '@/components/organization-form';
import { requireUser } from '@/lib/auth';
import { getOrganization } from '@/server/organizations/service';
import { AppError } from '@/server/shared/errors';

export const metadata: Metadata = { title: 'Thông tin Ban tổ chức' };

export default async function EditOrganizationPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const user = await requireUser();
  const org = await getOrganization(user.id, orgId).catch((e) => {
    if (e instanceof AppError) notFound();
    throw e;
  });
  const c = org.contacts;
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="display text-4xl leading-none">Thông tin BTC</h1>
      <OrganizationForm
        orgId={org.id}
        redirectTo={`/btc?btc=${org.id}`}
        initial={{
          name: org.name,
          phone: c.phone ?? '',
          zalo: c.zalo ?? '',
          facebook: c.facebook ?? '',
          tiktok: c.tiktok ?? '',
          bankBin: org.bankBin ?? '',
          bankAccountNo: org.bankAccountNo ?? '',
          bankAccountName: org.bankAccountName ?? '',
        }}
      />
    </main>
  );
}
