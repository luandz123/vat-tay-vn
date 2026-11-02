import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { requireUser } from '@/lib/auth';
import { AppError } from '@/server/shared/errors';
import { requireTournament } from '@/server/tournaments/service';
import { ManageNav } from './manage-nav';

export default async function TournamentLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const t = await requireTournament(user.id, id).catch((e) => {
    if (e instanceof AppError) notFound();
    throw e;
  });
  return (
    <div className="flex flex-wrap">
      <aside className="w-full border-b border-line bg-[#101218] px-3 py-3 lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r lg:py-5">
        <Link href="/btc" className="block px-2 pb-2 text-sm text-muted hover:text-fg">
          ← Giải của tôi
        </Link>
        <p className="truncate px-2 pb-3 font-semibold" title={t.name}>
          {t.name}
        </p>
        <ManageNav id={id} published={t.status !== 'draft'} slug={t.slug} />
      </aside>
      <div className="min-w-0 flex-[999_1_560px]">{children}</div>
    </div>
  );
}
