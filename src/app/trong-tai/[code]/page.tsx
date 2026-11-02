import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { brackets, categories, tournaments } from '@/db/schema';
import { LiveRefresh } from '@/components/live-refresh';
import { Logo } from '@/components/ui';
import { toBoardDTO } from '@/server/brackets/dto';
import { canUndo, computeState } from '@/server/brackets/engine';
import { getBoard, getMatchTallies, getTableQueue, tableByCode } from '@/server/brackets/service';
import { RefereeTablet } from './referee-tablet';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Trọng tài', robots: { index: false, follow: false } };

export default async function RefereePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const table = await tableByCode(code);
  if (!table)
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <Logo />
        <h1 className="display text-4xl">Link tablet không hợp lệ</h1>
        <p className="text-fg-2">Link đã hết hiệu lực hoặc bị đổi. Hãy xin BTC link mới.</p>
      </main>
    );
  const t = (await db.query.tournaments.findFirst({ where: eq(tournaments.id, table.tournamentId) }))!;
  const [{ queue, lastFinished }, board] = await Promise.all([getTableQueue(table.id), getBoard(t.id)]);
  const dto = toBoardDTO(board);
  const current = queue.find((m) => m.status === 'in_progress') ?? queue[0] ?? null;
  const describe = async (matchId: string, bracketId: string) => {
    const b = (await db.query.brackets.findFirst({ where: eq(brackets.id, bracketId) }))!;
    const c = (await db.query.categories.findFirst({ where: eq(categories.id, b.categoryId) }))!;
    const cat = dto.categories.find((x) => x.id === c.id)!;
    const wbMax = Math.max(...cat.matches.filter((m) => m.side === 'winners').map((m) => m.round));
    return { category: c, cat, wbMax, matchId };
  };
  const cur = current ? await describe(current.id, current.bracketId) : null;
  let undoable = false;
  if (lastFinished) {
    const ld = await describe(lastFinished.id, lastFinished.bracketId);
    const st = computeState(
      ld.cat.matches.map((m) => {
        const raw = board.categories.find((x) => x.category.id === ld.category.id)!.matches.find((x) => x.id === m.id)!;
        return { key: m.id, side: m.side, round: m.round, position: raw.position, number: m.number, red: m.side === 'winners' && m.round === 1 ? m.red : null, blue: m.side === 'winners' && m.round === 1 ? m.blue : null, next: raw.nextMatchId, nextSlot: raw.nextSlot, loserNext: raw.loserNextMatchId, loserNextSlot: raw.loserNextSlot };
      }),
      new Map(ld.cat.matches.filter((m) => m.status === 'finished' && m.winner).map((m) => [m.id, m.winner!])),
    );
    undoable = canUndo(st, lastFinished.id);
  }
  const tallies = current ? await getMatchTallies(current.id) : {};
  const name = (id: string | null) => (id ? dto.entries[id] ?? null : null);

  return (
    <>
      <LiveRefresh tournamentId={t.id} intervalMs={5000} />
      <RefereeTablet
        code={code}
        tableName={table.name}
        refereeName={table.refereeName}
        tournamentName={t.name}
        current={
          current && cur
            ? {
                id: current.id,
                number: current.number,
                version: current.version,
                status: current.status,
                title: `${cur.category.hand === 'left' ? 'Tay trái' : 'Tay phải'} · ${cur.category.label} · ${current.side === 'grand_final' ? 'Chung kết tổng' : current.side === 'third_place' ? 'Tranh hạng 3' : current.side === 'losers' ? `Nhánh thua V${current.round}` : current.round === cur.wbMax ? 'Chung kết' : current.round === cur.wbMax - 1 ? 'Bán kết' : `Vòng ${current.round}`} · Trận ${current.number}`,
                red: current.redEntryId ? { id: current.redEntryId, ...name(current.redEntryId)!, ...(tallies[current.redEntryId] ?? { foul: 0, warning: 0 }) } : null,
                blue: current.blueEntryId ? { id: current.blueEntryId, ...name(current.blueEntryId)!, ...(tallies[current.blueEntryId] ?? { foul: 0, warning: 0 }) } : null,
              }
            : null
        }
        next={queue.filter((m) => m.id !== current?.id).slice(0, 3).map((m) => `T${m.number}: ${name(m.redEntryId)?.name ?? '…'} vs ${name(m.blueEntryId)?.name ?? '…'}`)}
        last={lastFinished && undoable ? { id: lastFinished.id, winner: name(lastFinished.winnerEntryId)?.name ?? '' , number: lastFinished.number } : null}
      />
    </>
  );
}
