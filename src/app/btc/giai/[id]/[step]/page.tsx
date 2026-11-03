import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { AppError } from '@/server/shared/errors';
import { toVnLocal } from '@/server/shared/time';
import { getChecklist, getTournamentForEdit } from '@/server/tournaments/service';
import { buildSharePost } from '@/server/tournaments/share-post';
import { CATEGORY_TEMPLATES } from '@/server/tournaments/templates';
import { publicUrl } from '@/lib/storage';
import { CategoriesStep } from '../../_steps/categories-step';
import { InfoStep } from '../../_steps/info-step';
import { PricingStep } from '../../_steps/pricing-step';
import { PublishStep } from '../../_steps/publish-step';
import { ScheduleStep } from '../../_steps/schedule-step';
import { STEPS } from '../../_steps/steps';

export const metadata: Metadata = { title: 'Tạo giải' };

export default async function WizardPage({ params }: { params: Promise<{ id: string; step: string }> }) {
  const { id, step } = await params;
  const index = STEPS.findIndex((s) => s.slug === step);
  if (index < 0) notFound();
  const user = await requireUser();
  const d = await getTournamentForEdit(user.id, id).catch((e) => {
    if (e instanceof AppError) notFound();
    throw e;
  });
  const t = d.tournament;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/btc" className="text-sm text-muted hover:text-fg">
          ← Giải của tôi
        </Link>
        <span className="truncate font-semibold">{t.name}</span>
        <span className="px-2 py-0.5 text-xs font-bold text-fg-2 ring-1 ring-line-strong">{t.status === 'draft' ? 'Nháp' : 'Đã xuất bản'}</span>
      </div>

      <nav aria-label="Các bước tạo giải" className="grid grid-cols-2 gap-x-1 gap-y-3 sm:grid-cols-5">
        {STEPS.map((s, i) => (
          <a key={s.slug} href={`/btc/giai/${id}/${s.slug}`} aria-current={i === index ? 'step' : undefined} className="flex flex-col gap-2">
            <span className={`h-1 ${i <= index ? 'bg-brand' : 'bg-line-strong'}`} />
            <span className="flex items-baseline gap-2">
              <span className={`display text-lg ${i <= index ? 'text-brand-text' : 'text-muted'}`}>0{i + 1}</span>
              <span className={`text-sm font-semibold ${i === index ? 'text-fg' : 'text-muted'}`}>{s.title}</span>
            </span>
          </a>
        ))}
      </nav>

      {step === 'thong-tin' && (
        <InfoStep
          tournamentId={id}
          status={t.status}
          coverUrl={t.coverImageKey ? publicUrl(t.coverImageKey) : null}
          ogUrl={t.ogImageKey ? publicUrl(t.ogImageKey) : null}
          initial={{
            name: t.name,
            slug: t.slug,
            description: t.description ?? '',
            rules: t.rules ?? '',
            notes: t.notes ?? '',
            startsAt: toVnLocal(t.startsAt),
            endsAt: toVnLocal(t.endsAt),
            venueName: t.venueName ?? '',
            venueAddress: t.venueAddress ?? '',
            mapsUrl: t.mapsUrl ?? '',
            registrationDeadline: toVnLocal(t.registrationDeadline),
            capacity: t.capacity?.toString() ?? '',
            birthYearMin: t.birthYearMin?.toString() ?? '',
            birthYearMax: t.birthYearMax?.toString() ?? '',
            weightToleranceKg: t.weightToleranceKg ? String(t.weightToleranceKg) : '',
            phone: t.contacts?.phone ?? d.organization.contacts.phone ?? '',
            zalo: t.contacts?.zalo ?? d.organization.contacts.zalo ?? '',
            facebook: t.contacts?.facebook ?? d.organization.contacts.facebook ?? '',
            tiktok: t.contacts?.tiktok ?? d.organization.contacts.tiktok ?? '',
          }}
        />
      )}
      {step === 'hang-muc' && (
        <CategoriesStep
          key={d.categories.map((c) => c.id).join()}
          tournamentId={id}
          templates={CATEGORY_TEMPLATES}
          defaultBirthYears={[t.birthYearMin, t.birthYearMax]}
          initial={d.categories.map((c) => ({
            key: c.id,
            kind: c.kind,
            hand: c.hand,
            gender: c.gender,
            label: c.label,
            weightMinKg: c.weightMinKg,
            weightMaxKg: c.weightMaxKg,
            birthYearMin: c.birthYearMin,
            birthYearMax: c.birthYearMax,
            capacity: c.capacity,
            sessionKey: c.sessionId,
            allAroundMaxPlace: c.allAroundMaxPlace,
            allAroundSourceKeys: c.allAroundSourceIds,
          }))}
        />
      )}
      {step === 'le-phi' && (
        <PricingStep
          key={d.priceTiers.map((p) => p.id).join()}
          tournamentId={id}
          hasBankInfo={!!d.organization.bankAccountNo}
          organizationId={d.organization.id}
          initial={d.priceTiers.map((p) => ({
            key: p.id,
            kind: p.kind,
            name: p.name,
            validUntil: toVnLocal(p.validUntil),
            singleHandPrice: String(p.singleHandPrice),
            bothHandsPrice: p.bothHandsPrice === null ? '' : String(p.bothHandsPrice),
          }))}
        />
      )}
      {step === 'lich-giai-thuong' && (
        <ScheduleStep
          key={[...d.sessions.map((x) => x.id), ...d.prizes.map((x) => x.id)].join()}
          tournamentId={id}
          categories={d.categories.map((c) => ({ id: c.id, label: c.label, hand: c.hand, gender: c.gender, kind: c.kind, sessionId: c.sessionId }))}
          initialSessions={d.sessions.map((s) => ({
            key: s.id,
            name: s.name,
            weighInStart: toVnLocal(s.weighInStart),
            weighInEnd: toVnLocal(s.weighInEnd),
            competeStart: toVnLocal(s.competeStart),
            competeEnd: toVnLocal(s.competeEnd),
          }))}
          initialPrizes={d.prizes.map((p) => ({
            key: p.id,
            categoryKey: p.categoryId,
            place: p.place,
            title: p.title,
            description: p.description ?? '',
            cashAmount: p.cashAmount === null ? '' : String(p.cashAmount),
          }))}
        />
      )}
      {step === 'xuat-ban' && (
        <PublishStep
          tournamentId={id}
          status={t.status}
          url={`${site}/${t.slug}`}
          issues={await getChecklist(user.id, id)}
          sharePost={
            t.startsAt && t.venueName
              ? buildSharePost({
                  name: t.name,
                  startsAt: t.startsAt,
                  venueName: t.venueName,
                  venueAddress: t.venueAddress,
                  registrationDeadline: t.registrationDeadline,
                  url: `${site}/${t.slug}`,
                  categories: d.categories,
                  priceTiers: d.priceTiers,
                  prizes: d.prizes,
                  contactPhone: t.contacts?.phone ?? d.organization.contacts.phone ?? null,
                })
              : null
          }
        />
      )}
    </main>
  );
}
