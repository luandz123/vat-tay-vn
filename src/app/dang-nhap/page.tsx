import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/ui';
import { getCurrentUser, googleEnabled } from '@/lib/auth';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Đăng nhập BTC' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; loi?: string; tao?: string }> }) {
  const { next, loi, tao } = await searchParams;
  const safeNext = next?.startsWith('/') && !next.startsWith('//') ? next : '/btc';
  if (await getCurrentUser()) redirect(safeNext);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-12">
      <Link href="/" aria-label="Trang chủ">
        <Logo />
      </Link>
      <h1 className="display text-4xl leading-none">
        Đăng nhập <span className="text-brand-text">Ban tổ chức</span>
      </h1>
      {loi && <p className="text-sm text-brand-text">Link đăng nhập đã hết hạn hoặc không hợp lệ. Hãy gửi lại.</p>}
      <LoginForm next={safeNext} initialMode={tao ? 'signup' : 'signin'} google={await googleEnabled()} />
      <p className="text-sm text-muted">Vận động viên không cần đăng nhập — đăng ký trực tiếp trên trang giải.</p>
    </main>
  );
}
