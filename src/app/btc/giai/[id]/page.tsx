import type { Metadata } from 'next';
import Link from 'next/link';
import { ShareTools } from '@/components/share-tools';
import { Card, buttonClass } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { getDashboardStats } from '@/server/manage/registrations';
import { formatDateTime, formatVnd } from '@/server/shared/time';
import { getTournamentForEdit } from '@/server/tournaments/service';
import { buildSharePost } from '@/server/tournaments/share-post';

export const metadata: Metadata = { title: 'Tổng quan giải' };

export default async function OverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const [d, s] = await Promise.all([getTournamentForEdit(user.id, id), getDashboardStats(user.id, id)]);
  const t = d.tournament;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const url = `${site}/${t.slug}`;
  const kpis = [
    { l: 'VĐV đăng ký', v: `${s.athletes}${s.capacity ? ` / ${s.capacity}` : ''}`, sub: `${s.entries} lượt hạng mục` },
    { l: 'Đã thu', v: formatVnd(s.paid), sub: `/ ${formatVnd(s.due)} phải thu` },
    { l: 'Chờ duyệt', v: String(s.pending), sub: `${s.ageWarning} cảnh báo năm sinh`, href: `/btc/giai/${id}/dang-ky?loc=pending` },
    { l: 'Chưa đóng đủ', v: String(s.unpaid), sub: s.unmatched ? `${s.unmatched} giao dịch chờ ghép` : 'Không có giao dịch lạ', href: `/btc/giai/${id}/dang-ky?loc=unpaid` },
  ];
  return (
    <main className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">
            {t.status === 'draft' ? 'Nháp' : t.status === 'published' ? 'Đang mở đăng ký' : t.status} · {t.startsAt ? formatDateTime(t.startsAt) : 'Chưa có ngày'} · {t.venueName ?? '—'}
          </span>
          <h1 className="display text-4xl leading-none">{t.name}</h1>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Link href={`/btc/giai/${id}/thong-bao`} className={buttonClass('secondary')}>Dời lịch / Gửi thông báo</Link>
          {t.status === 'draft' && <Link href={`/btc/giai/${id}/xuat-ban`} className={buttonClass('primary')}>Xuất bản</Link>}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => {
          const inner = (
            <>
              <span className="text-xs uppercase tracking-wider text-muted">{k.l}</span>
              <span className="font-display text-4xl font-bold leading-none">{k.v}</span>
              <span className="text-sm text-fg-2">{k.sub}</span>
            </>
          );
          return k.href ? (
            <Link key={k.l} href={k.href} className="flex flex-col gap-1.5 border border-line bg-surface p-4 hover:border-line-strong">{inner}</Link>
          ) : (
            <div key={k.l} className="flex flex-col gap-1.5 border border-line bg-surface p-4">{inner}</div>
          );
        })}
      </div>

      {t.status !== 'draft' && (
        <Card title="Chia sẻ giải">
          <span className="text-xl font-bold">{url.replace(/^https?:\/\//, '')}</span>
          <ShareTools
            url={url}
            title={t.name}
            slug={t.slug}
            post={t.startsAt && t.venueName ? buildSharePost({ name: t.name, startsAt: t.startsAt, venueName: t.venueName, venueAddress: t.venueAddress, registrationDeadline: t.registrationDeadline, url, categories: d.categories, priceTiers: d.priceTiers, prizes: d.prizes, contactPhone: t.contacts?.phone ?? d.organization.contacts.phone ?? null }) : null}
          />
        </Card>
      )}
    </main>
  );
}
