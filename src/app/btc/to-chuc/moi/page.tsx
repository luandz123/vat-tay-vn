import type { Metadata } from 'next';
import { OrganizationForm } from '@/components/organization-form';

export const metadata: Metadata = { title: 'Tạo Ban tổ chức' };

export default function NewOrganizationPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="display text-4xl leading-none">
          Tạo <span className="text-brand-text">Ban tổ chức</span>
        </h1>
        <p className="mt-2 text-fg-2">Thông tin này dùng chung cho mọi giải bạn tổ chức. Sửa lại được bất cứ lúc nào.</p>
      </div>
      <OrganizationForm redirectTo="/btc" />
    </main>
  );
}
