import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { pickPriceTier } from '@/server/registration/fees';
import { getPublicTournament } from '@/server/tournaments/service';
import { isValidSlug } from '@/server/tournaments/slug';
import { RegisterForm } from './register-form';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = isValidSlug(slug) ? await getPublicTournament(slug) : null;
  return { title: d ? `Đăng ký · ${d.tournament.name}` : 'Đăng ký', robots: { index: false } };
}

export default async function RegisterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = isValidSlug(slug) ? await getPublicTournament(slug) : null;
  if (!d) notFound();
  const t = d.tournament;
  const now = new Date();
  const closed = t.status !== 'published' || (t.registrationDeadline !== null && t.registrationDeadline < now);
  const tier = pickPriceTier(d.priceTiers, 'online', now) ?? pickPriceTier(d.priceTiers, 'onsite', now);
  return (
    <RegisterForm
      slug={slug}
      tournamentName={t.name}
      closed={closed}
      tier={tier ? { name: tier.name, singleHandPrice: tier.singleHandPrice, bothHandsPrice: tier.bothHandsPrice } : null}
      categories={d.categories
        .filter((c) => c.kind === 'weight')
        .map((c) => ({
          id: c.id,
          hand: c.hand,
          gender: c.gender,
          label: c.label,
          birthYearMin: c.birthYearMin,
          birthYearMax: c.birthYearMax,
          full: c.capacity !== null && c.registered >= c.capacity,
          session: d.sessions.find((s) => s.id === c.sessionId)?.name ?? null,
        }))}
    />
  );
}
