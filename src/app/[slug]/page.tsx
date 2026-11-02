import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { FinanceSummary, NoticeBanner } from '@/components/public-extras';
import { ShareTools } from '@/components/share-tools';
import { getPublicFinance } from '@/server/finance/service';
import { getLatestBanner } from '@/server/notifications/service';
import { Logo } from '@/components/ui';
import { publicUrl } from '@/lib/storage';
import { formatDateTime, formatDayDate, formatTime, formatVnd } from '@/server/shared/time';
import { getPublicTournament } from '@/server/tournaments/service';
import { buildSharePost } from '@/server/tournaments/share-post';
import { isValidSlug } from '@/server/tournaments/slug';
import { GENDER_LABEL, HAND_LABEL } from '@/server/tournaments/templates';
import { Countdown } from './countdown';

export const revalidate = 60;

const load = cache(async (slug: string) => (isValidSlug(slug) ? getPublicTournament(slug) : null));

const PLACE_COLOR: Record<number, string> = { 1: 'text-gold', 2: 'text-fg-2', 3: 'text-[#e08a4b]' };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = await load(slug);
  if (!d) return { title: 'Không tìm thấy giải' };
  const t = d.tournament;
  const description = [t.startsAt && formatDateTime(t.startsAt), t.venueName, 'Đăng ký online, không cần tài khoản'].filter(Boolean).join(' · ');
  const image = t.ogImageKey ? publicUrl(t.ogImageKey) : undefined;
  return {
    title: t.name,
    description,
    openGraph: { title: t.name, description, type: 'website', url: `/${t.slug}`, images: image ? [{ url: image, width: 1200, height: 628 }] : [] },
    twitter: { card: 'summary_large_image', title: t.name, description, images: image ? [image] : [] },
  };
}

export default async function TournamentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await load(slug);
  if (!d) notFound();
  const t = d.tournament;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const url = `${site}/${t.slug}`;
  const now = new Date();
  const open = t.status === 'published' && (!t.registrationDeadline || t.registrationDeadline > now);
  const seatsLeft = t.capacity ? Math.max(0, t.capacity - d.registeredCount) : null;
  const online = d.priceTiers.find((p) => p.kind === 'online' && (!p.validUntil || p.validUntil > now));
  const onsite = d.priceTiers.find((p) => p.kind === 'onsite');
  const weights = d.categories.filter((c) => c.kind === 'weight');
  const hands = (['right', 'left'] as const).filter((h) => weights.some((c) => c.hand === h));
  const minPrice = Math.min(...d.priceTiers.map((p) => p.singleHandPrice));
  const notes = (t.notes ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
  const c = d.contacts;
  const contactLinks = [
    c.zalo && { label: 'Zalo', href: /^\d+$/.test(c.zalo.replace(/\s/g, '')) ? `https://zalo.me/${c.zalo.replace(/\s/g, '')}` : c.zalo },
    c.facebook && { label: 'Facebook', href: c.facebook },
    c.tiktok && { label: 'TikTok', href: c.tiktok },
    c.phone && { label: 'Gọi BTC', href: `tel:${c.phone.replace(/\s/g, '')}` },
  ].filter((x): x is { label: string; href: string } => !!x);
  const post = t.startsAt && t.venueName
    ? buildSharePost({ name: t.name, startsAt: t.startsAt, venueName: t.venueName, venueAddress: t.venueAddress, registrationDeadline: t.registrationDeadline, url, categories: d.categories, priceTiers: d.priceTiers, prizes: d.prizes, contactPhone: c.phone ?? null })
    : null;
  const h2 = 'display text-3xl text-brand-text';
  const [banner, finance] = await Promise.all([getLatestBanner(t.id), getPublicFinance(t.id, false)]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <Link href="/" aria-label="VậtTay.vn">
          <Logo />
        </Link>
        <span className="text-xs text-muted">{d.organizationName}</span>
      </header>

      <NoticeBanner banner={banner} />

      <section className="relative mt-0">
        {t.ogImageKey ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={publicUrl(t.ogImageKey)} alt={`Ảnh bìa ${t.name}`} className="aspect-[1.91/1] w-full object-cover" />
        ) : (
          <div className="aspect-[1.91/1] w-full bg-surface" />
        )}
        {open && <span className="display btn-slant absolute left-3 top-3 bg-brand px-3 py-1 text-sm text-white">Đang mở đăng ký</span>}
      </section>

      <section className="flex flex-col items-center gap-4 px-4 pb-7 pt-6 text-center">
        <h1 className="display text-[40px] leading-[0.95] sm:text-5xl">{t.name}</h1>
        {t.startsAt && (
          <p className="font-semibold">
            {formatDayDate(t.startsAt)} · {t.venueName}
            {t.startsAt > now && ', bắt đầu sau'}
          </p>
        )}
        {t.startsAt && t.startsAt > now && <Countdown to={t.startsAt.toISOString()} />}
        <div className="flex w-full gap-2">
          {open ? (
            <a href={`/${t.slug}/dang-ky`} className="display btn-slant flex min-h-12 flex-1 items-center justify-center bg-brand text-lg text-white">
              Đăng ký ngay
            </a>
          ) : (
            <span className="display btn-slant flex min-h-12 flex-1 items-center justify-center bg-surface-2 text-lg text-fg-2">Đã đóng đăng ký</span>
          )}
          <a href="#chia-se" className="display btn-slant flex min-h-12 w-32 items-center justify-center bg-fg text-lg text-brand">
            Chia sẻ
          </a>
        </div>
        <p className="text-sm text-muted">Không cần tài khoản · Thanh toán VietQR về thẳng BTC</p>
      </section>

      <section className="grid grid-cols-2 gap-px border-y border-line bg-line">
        <Fact k="Thời gian" v={t.startsAt ? formatDateTime(t.startsAt) : '—'} />
        <Fact k="Địa điểm" v={t.venueName ?? '—'} s={t.mapsUrl ? { label: 'Mở Google Maps', href: t.mapsUrl } : undefined} />
        <Fact k="Hạn đăng ký" v={t.registrationDeadline ? formatDateTime(t.registrationDeadline) : 'Đến ngày thi đấu'} />
        <Fact k="Đã đăng ký" v={`${d.registeredCount}${t.capacity ? ` / ${t.capacity}` : ''} VĐV`} s={seatsLeft !== null ? { label: `Còn ${seatsLeft} suất` } : undefined} />
      </section>

      {t.description && <p className="whitespace-pre-line px-4 pt-7 text-fg-2">{t.description}</p>}

      <section className="flex flex-col gap-3 px-4 pt-8">
        <h2 className={h2}>Hạng mục thi đấu</h2>
        {hands.map((h) => (
          <div key={h} className="flex flex-col gap-2">
            <h3 className="display text-lg">{HAND_LABEL[h]}</h3>
            <ul className="flex flex-col border border-line">
              {weights.filter((c) => c.hand === h).map((cat) => (
                <li key={cat.id} className="flex items-center gap-3 border-b border-line bg-surface px-3.5 py-3 last:border-b-0">
                  <span className="display w-20 text-2xl">{cat.label}</span>
                  <span className="flex flex-1 flex-col">
                    <span className="font-semibold">{GENDER_LABEL[cat.gender]}</span>
                    <span className="text-sm text-muted">
                      {cat.birthYearMin || t.birthYearMin || cat.birthYearMax || t.birthYearMax
                        ? `Sinh ${cat.birthYearMin ?? t.birthYearMin ?? '…'} – ${cat.birthYearMax ?? t.birthYearMax ?? '…'}`
                        : 'Không giới hạn tuổi'}
                    </span>
                  </span>
                  <span className="text-sm text-fg-2">{cat.registered} VĐV</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="text-sm text-muted">
          {t.weightToleranceKg > 0 && `Dung sai cân: +${t.weightToleranceKg} kg. `}
          {d.categories.some((x) => x.kind === 'all_around') && 'Có hạng Toàn năng tự động.'}
        </p>
      </section>

      {d.priceTiers.length > 0 && (
        <section className="flex flex-col gap-3 px-4 pt-8">
          <h2 className={h2}>Lệ phí</h2>
          <div className="grid grid-cols-2 gap-2">
            {[online ?? onsite].filter(Boolean).map((p) => (
              <div key={p!.id} className="flex flex-col gap-1.5 border border-line bg-surface p-3.5">
                <span className="display text-lg">1 tay</span>
                <span className="font-display text-3xl font-bold leading-none">{p!.singleHandPrice === 0 ? 'Miễn phí' : formatVnd(p!.singleHandPrice)}</span>
                <span className="text-sm text-muted">{onsite && p!.kind === 'online' ? `Tại sân ${formatVnd(onsite.singleHandPrice)}` : p!.name}</span>
              </div>
            ))}
            {(online ?? onsite)?.bothHandsPrice != null && (
              <div className="flex flex-col gap-1.5 bg-brand p-3.5 text-white">
                <span className="display text-lg">Combo 2 tay</span>
                <span className="font-display text-3xl font-bold leading-none">{formatVnd((online ?? onsite)!.bothHandsPrice!)}</span>
                <span className="text-sm">
                  {onsite?.bothHandsPrice != null && online ? `Tại sân ${formatVnd(onsite.bothHandsPrice)}` : (online ?? onsite)!.name}
                </span>
              </div>
            )}
          </div>
          {online?.validUntil && <p className="text-sm text-muted">Giá “{online.name}” áp dụng đến {formatDateTime(online.validUntil)}</p>}
        </section>
      )}

      {d.sessions.length > 0 && (
        <section className="flex flex-col gap-3 px-4 pt-8">
          <h2 className={h2}>Lịch thi đấu</h2>
          {d.sessions.map((s) => (
            <div key={s.id} className="flex gap-4 border border-line bg-surface p-3.5">
              <span className="display w-20 text-xl text-brand-text">{s.name}</span>
              <div className="flex flex-col gap-1 text-sm">
                {s.weighInStart && <span><strong>Cân:</strong> {formatTime(s.weighInStart)}{s.weighInEnd && ` – ${formatTime(s.weighInEnd)}`}</span>}
                {s.competeStart && <span><strong>Thi đấu:</strong> {formatTime(s.competeStart)}{s.competeEnd && ` – ${formatTime(s.competeEnd)}`}</span>}
                <span className="text-muted">
                  {d.categories.filter((x) => x.sessionId === s.id).map((x) => `${HAND_LABEL[x.hand].replace('Tay ', '')} ${x.label}`).join(' · ') || '—'}
                </span>
              </div>
            </div>
          ))}
        </section>
      )}

      {d.prizes.length > 0 && (
        <section className="flex flex-col gap-3 px-4 pt-8">
          <h2 className={h2}>Giải thưởng</h2>
          <div className="grid grid-cols-2 gap-2">
            {d.prizes.map((p) => (
              <div key={p.id} className="flex flex-col gap-0.5 border border-line bg-surface px-3.5 py-3">
                <span className={`display text-lg ${PLACE_COLOR[p.place] ?? ''}`}>{p.title}</span>
                <span className="text-sm">
                  {[p.description, p.cashAmount ? formatVnd(p.cashAmount) : null].filter(Boolean).join(' + ') || '—'}
                </span>
                {p.categoryId && <span className="text-xs text-muted">{d.categories.find((x) => x.id === p.categoryId)?.label}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {(notes.length > 0 || t.rules) && (
        <section className="flex flex-col gap-3 px-4 pt-8">
          <h2 className={h2}>Lưu ý</h2>
          {notes.length > 0 && (
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-fg-2">
              {notes.map((n) => <li key={n}>{n}</li>)}
            </ul>
          )}
          {t.rules && (
            <details>
              <summary className="cursor-pointer font-semibold text-brand-text">Xem điều lệ đầy đủ</summary>
              <p className="mt-2 whitespace-pre-line text-sm text-fg-2">{t.rules}</p>
            </details>
          )}
        </section>
      )}

      <FinanceSummary data={finance} />

      {contactLinks.length > 0 && (
        <section className="flex flex-col gap-3 px-4 pt-8">
          <h2 className={h2}>Liên hệ BTC</h2>
          <div className="grid grid-cols-2 gap-2">
            {contactLinks.map((l) => (
              <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center border border-line-strong bg-surface font-semibold">
                {l.label}
              </a>
            ))}
          </div>
        </section>
      )}

      <section id="chia-se" className="mt-8 flex flex-col gap-3 bg-brand px-4 py-6 text-white">
        <h2 className="display text-3xl">Rủ hội cùng thi!</h2>
        <ShareTools url={url} title={t.name} post={post} slug={t.slug} tone="brand" />
        <span className="text-sm">{url.replace(/^https?:\/\//, '')}</span>
      </section>

      <footer className="px-4 pb-28 pt-5 text-center text-xs text-muted">Tổ chức trên VậtTay.vn · Nền tảng không giữ tiền hộ BTC</footer>

      {open && (
        <div className="sticky bottom-0 flex items-center gap-3 border-t border-line bg-bg px-4 py-2.5">
          <div className="flex-1">
            {seatsLeft !== null && <div className="text-xs text-muted">Còn {seatsLeft}/{t.capacity} suất</div>}
            {Number.isFinite(minPrice) && <div className="font-bold">{minPrice === 0 ? 'Miễn phí' : `Từ ${formatVnd(minPrice)}`}</div>}
          </div>
          <a href={`/${t.slug}/dang-ky`} className="display btn-slant flex min-h-12 items-center bg-brand px-7 text-lg text-white">
            Đăng ký
          </a>
        </div>
      )}
    </div>
  );
}

function Fact({ k, v, s }: { k: string; v: string; s?: { label: string; href?: string } }) {
  return (
    <div className="flex flex-col gap-1 bg-surface px-4 py-3.5">
      <span className="text-xs uppercase tracking-wider text-muted">{k}</span>
      <span className="font-bold">{v}</span>
      {s && (s.href ? <a href={s.href} target="_blank" rel="noreferrer" className="text-sm text-brand-text">{s.label}</a> : <span className="text-sm text-brand-text">{s.label}</span>)}
    </div>
  );
}
