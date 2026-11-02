import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { Logo } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function BtcLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/dang-nhap?next=/btc');
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-4 border-b border-line px-4 py-3 sm:px-6">
        <Link href="/btc" aria-label="Khu BTC">
          <Logo />
        </Link>
        <span className="text-sm text-muted">Khu Ban tổ chức</span>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="hidden text-fg-2 sm:inline">{user.email}</span>
          <form action="/auth/dang-xuat" method="post">
            <button className="min-h-10 border border-line-strong px-3 font-semibold hover:bg-surface-2">Đăng xuất</button>
          </form>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
