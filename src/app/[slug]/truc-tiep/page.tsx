import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicBoard } from '@/server/brackets/public';
import { isValidSlug } from '@/server/tournaments/slug';
import { LiveBoard } from './live-board';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = isValidSlug(slug) ? await getPublicBoard(slug) : null;
  return { title: d ? `Trực tiếp · ${d.tournament.name}` : 'Trực tiếp' };
}

export default async function LivePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = isValidSlug(slug) ? await getPublicBoard(slug) : null;
  if (!data) notFound();
  return <LiveBoard slug={slug} initial={data} />;
}
