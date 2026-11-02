import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { Logo } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/dang-nhap?next=/admin');
  if (user.role !== 'admin') notFound();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-4 border-b border-line px-4 py-3 sm:px-6">
        <Link href="/admin"><Logo /></Link>
        <span className="bg-brand px-2 py-0.5 text-xs font-bold text-white">ADMIN</span>
        <nav className="flex gap-4 text-sm font-semibold">
          <Link href="/admin" className="hover:text-brand-text">Tổng quan</Link>
          <Link href="/admin/nhat-ky" className="hover:text-brand-text">Nhật ký kết quả</Link>
          <Link href="/btc" className="hover:text-brand-text">Khu BTC</Link>
        </nav>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
