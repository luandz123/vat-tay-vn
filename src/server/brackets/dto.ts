/** Dữ liệu bảng đấu dạng thuần (JSON) cho giao diện: không có SĐT, chỉ tên/CLB/cân. */
import type { Board } from './service';

export interface MatchDTO {
  id: string;
  side: 'winners' | 'losers' | 'grand_final' | 'third_place';
  round: number;
  number: number;
  red: string | null;
  blue: string | null;
  winner: string | null;
  status: 'pending' | 'ready' | 'on_table' | 'in_progress' | 'finished' | 'bye' | 'skipped';
  tableId: string | null;
  queuePosition: number | null;
  version: number;
  notBefore: string | null;
}

export interface CategoryBoardDTO {
  id: string;
  label: string;
  hand: 'left' | 'right';
  gender: 'male' | 'female' | 'open';
  kind: 'weight' | 'all_around';
  sessionId: string | null;
  bracket: { id: string; type: 'single' | 'double'; status: string; thirdPlaceMatch: boolean; grandFinalReset: boolean } | null;
  matches: MatchDTO[];
  results: { entryId: string; place: number }[];
  entrantCount: number;
  checkedInCount: number;
}

export interface BoardDTO {
  categories: CategoryBoardDTO[];
  tables: { id: string; name: string; status: string; refereeName: string | null; hasCode: boolean }[];
  entries: Record<string, { name: string; club: string | null; kg: number | null }>;
}

export function toBoardDTO(b: Board): BoardDTO {
  return {
    categories: b.categories.map((c) => ({
      id: c.category.id,
      label: c.category.label,
      hand: c.category.hand,
      gender: c.category.gender,
      kind: c.category.kind,
      sessionId: c.category.sessionId,
      bracket: c.bracket
        ? { id: c.bracket.id, type: c.bracket.type, status: c.bracket.status, thirdPlaceMatch: c.bracket.thirdPlaceMatch, grandFinalReset: c.bracket.grandFinalReset }
        : null,
      matches: c.matches.map((m) => ({
        id: m.id, side: m.side, round: m.round, number: m.number, red: m.redEntryId, blue: m.blueEntryId, winner: m.winnerEntryId,
        status: m.status, tableId: m.tableId, queuePosition: m.queuePosition, version: m.version,
        notBefore: m.notBefore && m.notBefore > new Date() ? m.notBefore.toISOString() : null,
      })),
      results: c.results.map((r) => ({ entryId: r.entryId, place: r.place })),
      entrantCount: c.entrantCount,
      checkedInCount: c.checkedInCount,
    })),
    tables: b.tables.map((t) => ({ id: t.id, name: t.name, status: t.status, refereeName: t.refereeName, hasCode: !!t.accessTokenHash })),
    entries: Object.fromEntries([...b.entries.values()].map((e) => [e.id, { name: e.name, club: e.club, kg: e.kg }])),
  };
}

/** Tên vòng hiển thị. */
export function roundLabel(side: MatchDTO['side'], round: number, maxRound: number): string {
  if (side === 'grand_final') return round === 1 ? 'Chung kết tổng' : 'Chung kết đấu lại';
  if (side === 'third_place') return 'Tranh hạng 3';
  if (side === 'losers') return `Nhánh thua · vòng ${round}`;
  const left = maxRound - round;
  return left === 0 ? 'Chung kết' : left === 1 ? 'Bán kết' : left === 2 ? 'Tứ kết' : `Vòng ${round}`;
}
