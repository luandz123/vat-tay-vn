import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { LoginForm } from '@/app/dang-nhap/login-form';
import { Logo } from '@/components/ui';
import { getCurrentUser, googleEnabled } from '@/lib/auth';
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
  const user = closed ? null : await getCurrentUser();
  if (!closed && !user)
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 py-8">
        <Link href={`/${slug}`} className="text-sm text-muted">← {t.name}</Link>
        <Logo />
        <h1 className="display text-4xl leading-none">
          Đăng nhập để <span className="text-brand-text">đăng ký thi đấu</span>
        </h1>
        <p className="text-fg-2">Đăng nhập một lần (Google chỉ mất vài giây) để giữ vé, xem lại lịch đấu và các giải đã tham gia.</p>
        <LoginForm next={`/${slug}/dang-ky`} initialMode="signin" google={await googleEnabled()} />
      </main>
    );
  return (
    <RegisterForm
      slug={slug}
      initialName={user?.fullName ?? ''}
      initialEmail={user?.email ?? ''}
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
