import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FinanceSummary, NoticeBanner } from '@/components/public-extras';
import { Logo } from '@/components/ui';
import { getPublicFinance } from '@/server/finance/service';
import { getLatestBanner } from '@/server/notifications/service';
import { LiveRefresh } from '@/components/live-refresh';
import { getMyMatches } from '@/server/brackets/public';
import { vietQrPayload } from '@/server/payments/vietqr';
import { formatPhone } from '@/server/registration/rules';
import { getTicket } from '@/server/registration/service';
import { bankName } from '@/server/shared/banks';
import { formatDateTime, formatTime, formatVnd } from '@/server/shared/time';
import { GENDER_LABEL, HAND_LABEL } from '@/server/tournaments/templates';
import { PaymentPanel, QrImage } from './payment-panel';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Vé của tôi', robots: { index: false, follow: false } };

const PAY: Record<string, { label: string; cls: string }> = {
  paid: { label: 'Đã đóng', cls: 'text-success' },
  partial: { label: 'Đóng thiếu', cls: 'text-[#b45309]' },
  unpaid: { label: 'Chưa đóng', cls: 'text-[#b45309]' },
  refunded: { label: 'Đã hoàn', cls: 'text-[#5b606c]' },
};

export default async function TicketPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ticket = await getTicket(token);
  if (!ticket) notFound();
  const { registration: r, athlete: a, tournament: t, bank, entries } = ticket;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const remaining = Math.max(0, r.amountDue - r.amountPaid);
  const canPay = remaining > 0 && bank.bin && bank.accountNo && r.status !== 'cancelled';
  const pay = PAY[r.paymentStatus]!;
  const [banner, finance, myMatches] = await Promise.all([getLatestBanner(t.id), getPublicFinance(t.id, true), getMyMatches(r.id, t.id)]);
  const STATUS: Record<string, string> = { in_progress: 'Đang đấu', on_table: 'Đã lên bàn', ready: 'Chờ gán bàn', pending: 'Chờ trận trước', done: 'Đã xong', none: 'Chưa xếp bảng' };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col pb-10">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <Link href="/" aria-label="VậtTay.vn"><Logo /></Link>
        <span className="text-xs text-muted">Lưu link này để xem lại vé</span>
      </header>

      <NoticeBanner banner={banner} />

      {r.paymentStatus === 'paid' && r.amountDue > 0 && (
        <div className="mx-4 mt-4 flex items-center gap-3 bg-[#0f2418] p-3.5 text-success-text" role="status">
          <span className="flex size-9 items-center justify-center rounded-full bg-success text-white" aria-hidden="true">✓</span>
          <span className="font-semibold">BTC đã nhận {formatVnd(r.amountPaid)}. Hẹn gặp bạn ở giải!</span>
        </div>
      )}

      {canPay && (
        <>
          <h1 className="display px-4 pt-5 text-3xl">Thanh toán lệ phí</h1>
          <PaymentPanel
            token={token}
            payload={vietQrPayload({ bankBin: bank.bin!, accountNo: bank.accountNo!, amount: remaining, content: r.transferRef })}
            remaining={remaining}
            bankName={bankName(bank.bin) ?? bank.bin!}
            accountNo={bank.accountNo!}
            accountName={bank.accountName ?? bank.organizationName}
            transferRef={r.transferRef}
          />
        </>
      )}

      <section className="mx-4 mt-6 flex flex-col bg-fg text-bg">
        <div className="flex items-center justify-between bg-brand px-4 py-3 text-white">
          <span className="display truncate text-lg">{t.name}</span>
          {t.startsAt && <span className="shrink-0 text-sm font-semibold">{formatTime(t.startsAt)} · {formatDateTime(t.startsAt).split(' · ')[1]}</span>}
        </div>
        <div className="flex flex-col items-center gap-2.5 px-4 py-5">
          <QrImage text={`${site}/ve/${token}`} label="Mã QR check-in" size={180} />
          <span className="text-sm font-bold tracking-[0.2em]">#{r.code}</span>
          <span className="display text-3xl leading-none">{a.fullName}</span>
          <span className="text-sm text-[#3c404b]">
            {a.gender === 'male' ? 'Nam' : 'Nữ'} · Sinh {a.birthYear} · {formatPhone(a.phone)}
            {a.club && ` · ${a.club}`}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t-2 border-dashed border-[#c9ccd4] px-4 py-3 text-sm">
          {entries.map((e) => (
            <div key={e.id}>
              <div className="text-[#5b606c]">{HAND_LABEL[e.category.hand]}</div>
              <div className="font-bold">
                {GENDER_LABEL[e.category.gender]} {e.category.label}
              </div>
            </div>
          ))}
          <div>
            <div className="text-[#5b606c]">Lệ phí</div>
            <div className={`font-bold ${pay.cls}`}>
              {r.amountDue === 0 ? 'Miễn phí' : `${pay.label} ${formatVnd(r.amountPaid)}/${formatVnd(r.amountDue)}`}
            </div>
          </div>
          <div>
            <div className="text-[#5b606c]">Trạng thái</div>
            <div className="font-bold">{r.status === 'approved' ? 'Đã duyệt' : r.status === 'pending' ? 'Chờ BTC duyệt' : r.status === 'rejected' ? 'Bị từ chối' : 'Đã hủy'}</div>
          </div>
          <div className="col-span-2">
            <div className="text-[#5b606c]">Cân ký</div>
            <div className="font-bold">{r.weighedKg ? `Đã cân ${Number(r.weighedKg)} kg` : 'Chưa cân'}</div>
          </div>
        </div>
      </section>
      <p className="px-4 pt-3 text-center text-sm text-muted">Đưa mã này cho bàn cân để check-in. Nên chụp màn hình phòng khi mất mạng.</p>

      {myMatches.length > 0 && (
        <section className="flex flex-col gap-3 px-4 pt-7">
          <LiveRefresh tournamentId={t.id} intervalMs={20000} />
          <h2 className="display text-2xl text-brand-text">Trận tiếp theo của tôi</h2>
          {myMatches.map((mm) => (
            <div key={mm.categoryLabel + mm.hand} className="flex flex-col gap-3 border-2 border-brand bg-surface p-4">
              <div className="flex items-center justify-between">
                <span className="display btn-slant bg-brand px-2.5 py-0.5 text-white">{mm.tableName ?? STATUS[mm.status]}</span>
                <span className="text-sm text-fg-2">{HAND_LABEL[mm.hand]} {mm.categoryLabel}{mm.matchNumber ? ` · Trận ${mm.matchNumber}` : ''}</span>
              </div>
              {mm.status !== 'done' && mm.status !== 'none' && (
                <>
                  <div className="text-lg">
                    vs <strong>{mm.opponent ?? 'chờ xác định'}</strong>
                  </div>
                  {mm.aheadOnTable !== null && (
                    <div className="text-sm text-warning-text">{mm.aheadOnTable === 0 ? 'Đến lượt bạn! Hãy có mặt ở bàn ngay.' : `Còn ${mm.aheadOnTable} trận trước bạn trên bàn này.`}</div>
                  )}
                </>
              )}
              {mm.path.length > 0 && (
                <div className="flex flex-col gap-1 text-sm">
                  {mm.path.map((p) => (
                    <div key={p.label} className="flex justify-between">
                      <span>{p.label} · {p.opponent ?? '…'}</span>
                      <span className={p.result === 'won' ? 'text-success-text' : p.result === 'lost' ? 'text-[#ff7a7f]' : 'text-muted'}>
                        {p.result === 'won' ? 'Thắng' : p.result === 'lost' ? 'Thua' : 'Sắp đấu'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          <Link href={`/${t.slug}/truc-tiep`} className="text-center text-sm font-semibold text-brand-text">Xem toàn bộ bảng đấu trực tiếp →</Link>
        </section>
      )}

      <FinanceSummary data={finance} />

      <div className="flex flex-col gap-2 px-4 pt-6">
        <Link href={`/${t.slug}`} className="flex min-h-12 items-center justify-center border-2 border-fg font-display text-lg font-extrabold uppercase italic">
          Xem trang giải
        </Link>
        <Link href={`/${t.slug}/dang-ky`} className="text-center text-sm font-semibold text-brand-text">
          Đăng ký thêm hạng mục
        </Link>
      </div>
    </main>
  );
}
