import type { Metadata } from 'next';
import { LiveRefresh } from '@/components/live-refresh';
import { requireUser } from '@/lib/auth';
import { toBoardDTO } from '@/server/brackets/dto';
import { getBoardForUser } from '@/server/brackets/service';
import { BracketManager } from './bracket-manager';

export const metadata: Metadata = { title: 'Bảng đấu & bàn' };

export default async function BracketPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ hang?: string }> }) {
  const { id } = await params;
  const { hang } = await searchParams;
  const user = await requireUser();
  const board = toBoardDTO(await getBoardForUser(user.id, id));
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  return (
    <>
      <LiveRefresh tournamentId={id} />
      <BracketManager tournamentId={id} board={board} selectedId={hang ?? board.categories[0]?.id ?? null} site={site} />
    </>
  );
}
