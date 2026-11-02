/** Dữ liệu bảng đấu công khai cho khán giả và "trận tiếp theo của tôi". */
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { registrationEntries, tournaments } from '@/db/schema';
import { toBoardDTO, type BoardDTO } from './dto';
import { getBoard } from './service';

export async function getPublicBoard(slug: string): Promise<(BoardDTO & { tournament: { id: string; name: string; slug: string } }) | null> {
  const t = await db.query.tournaments.findFirst({ where: eq(tournaments.slug, slug) });
  if (!t || t.status === 'draft') return null;
  const dto = toBoardDTO(await getBoard(t.id));
  // Khán giả chỉ cần hạng đã có bảng và VĐV xuất hiện trong bảng
  const cats = dto.categories.filter((c) => c.bracket);
  const used = new Set(cats.flatMap((c) => c.matches.flatMap((m) => [m.red, m.blue]).filter((x): x is string => !!x)));
  return {
    tournament: { id: t.id, name: t.name, slug: t.slug },
    categories: cats,
    tables: dto.tables.map((x) => ({ ...x, hasCode: false })),
    entries: Object.fromEntries(Object.entries(dto.entries).filter(([id]) => used.has(id))),
  };
}

export interface NextMatchInfo {
  categoryLabel: string;
  hand: 'left' | 'right';
  matchNumber: number;
  opponent: string | null;
  tableName: string | null;
  status: string;
  aheadOnTable: number | null;
  path: { label: string; result: 'won' | 'lost' | 'upcoming'; opponent: string | null }[];
}

/** Trận sắp tới của một đăng ký (theo từng hạng đang thi). */
export async function getMyMatches(registrationId: string, tournamentId: string): Promise<NextMatchInfo[]> {
  const entries = await db
    .select({ id: registrationEntries.id })
    .from(registrationEntries)
    .where(and(eq(registrationEntries.registrationId, registrationId), inArray(registrationEntries.status, ['active'])));
  if (!entries.length) return [];
  const ids = new Set(entries.map((e) => e.id));
  const dto = toBoardDTO(await getBoard(tournamentId));
  const out: NextMatchInfo[] = [];
  for (const c of dto.categories) {
    const mine = c.matches.filter((m) => (m.red && ids.has(m.red)) || (m.blue && ids.has(m.blue)));
    if (!mine.length) continue;
    const me = mine.flatMap((m) => [m.red, m.blue]).find((x) => x && ids.has(x))!;
    const opp = (m: (typeof mine)[number]) => {
      const o = m.red === me ? m.blue : m.red;
      return o ? dto.entries[o]?.name ?? null : null;
    };
    const upcoming = mine.filter((m) => ['ready', 'on_table', 'in_progress', 'pending'].includes(m.status)).sort((a, b) => a.number - b.number)[0];
    let aheadOnTable: number | null = null;
    if (upcoming?.tableId) {
      const onTable = dto.categories.flatMap((x) => x.matches).filter((m) => m.tableId === upcoming.tableId && ['on_table', 'in_progress'].includes(m.status));
      aheadOnTable = onTable.filter((m) => (m.queuePosition ?? 0) < (upcoming.queuePosition ?? 0)).length;
    }
    out.push({
      categoryLabel: c.label,
      hand: c.hand,
      matchNumber: upcoming?.number ?? 0,
      opponent: upcoming ? opp(upcoming) : null,
      tableName: upcoming?.tableId ? dto.tables.find((t) => t.id === upcoming.tableId)?.name ?? null : null,
      status: upcoming?.status ?? (c.bracket?.status === 'finished' ? 'done' : 'none'),
      aheadOnTable,
      path: mine
        .filter((m) => m.status !== 'bye' && m.status !== 'skipped')
        .sort((a, b) => a.number - b.number)
        .map((m) => ({ label: `Trận ${m.number}`, result: m.status === 'finished' ? (m.winner === me ? 'won' : 'lost') : 'upcoming', opponent: opp(m) })),
    });
  }
  return out;
}
