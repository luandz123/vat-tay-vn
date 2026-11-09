import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Logo, cx } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth';
import { listMyTickets } from '@/server/registration/service';
import { formatDateTime, formatVnd } from '@/server/shared/time';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Vé của tôi', robots: { index: false } };

export default async function MyTicketsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/dang-nhap?next=/ve');
  const tickets = await listMyTickets(user.id);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <Link href="/" aria-label="Trang chủ"><Logo /></Link>
        <span className="text-sm text-muted">{user.fullName || user.email}</span>
      </header>
      <h1 className="display text-4xl leading-none">Vé <span className="text-brand-text">của tôi</span></h1>
      {tickets.length === 0 && <p className="text-fg-2">Bạn chưa đăng ký giải nào bằng tài khoản này.</p>}
      <ul className="flex flex-col gap-3">
        {tickets.map((t) => (
          <li key={t.token}>
            <Link href={`/ve/${t.token}`} className="flex flex-col gap-1.5 border border-line bg-surface p-4 hover:border-line-strong">
              <span className="display text-xl leading-tight">{t.tournamentName}</span>
              <span className="text-sm text-fg-2">
                {t.athleteName} · #{t.code}
                {t.startsAt && ` · ${formatDateTime(t.startsAt)}`}
              </span>
              <span className={cx('text-sm font-bold', t.paymentStatus === 'paid' ? 'text-success-text' : 'text-[#f7c948]')}>
                {t.amountDue === 0 ? 'Miễn phí' : t.paymentStatus === 'paid' ? `Đã đóng ${formatVnd(t.amountPaid)}` : `Chưa đóng đủ · ${formatVnd(t.amountDue - t.amountPaid)}`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
