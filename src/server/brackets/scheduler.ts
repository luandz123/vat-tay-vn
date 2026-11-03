/**
 * Tự động gán trận vào bàn (thuần, không DB). Mỗi bàn giữ tối đa QUEUE_DEPTH trận (đang đấu + chuẩn bị).
 * Chọn trận theo: phiên sớm hơn → hạng bàn đang đấu (giữ VĐV ở một chỗ) → số trận nhỏ hơn;
 * tránh VĐV vừa đấu xong chưa đủ thời gian nghỉ (trừ khi không còn trận nào khác).
 */
export const QUEUE_DEPTH = 2;
export const REST_MS = 5 * 60_000;

export interface SchedTable {
  id: string;
  sortOrder: number;
  active: boolean;
}

export interface SchedMatch {
  id: string;
  categoryId: string;
  number: number;
  status: 'pending' | 'ready' | 'on_table' | 'in_progress' | 'finished' | 'bye' | 'skipped';
  tableId: string | null;
  queuePosition: number | null;
  red: string | null;
  blue: string | null;
  winner: string | null;
  finishedAt: Date | null;
  /** Bảng đã khóa hoặc đang đấu (bảng nháp không tự gán). */
  bracketLive: boolean;
  /** Mốc bắt đầu phiên của hạng (null = không có phiên). */
  sessionStart: Date | null;
  categoryOrder: number;
}

export interface Assignment {
  matchId: string;
  tableId: string;
  queuePosition: number;
}

export function planAssignments(tables: readonly SchedTable[], matches: readonly SchedMatch[], now: Date): Assignment[] {
  const out: Assignment[] = [];
  const queued = (tableId: string) => matches.filter((m) => m.tableId === tableId && (m.status === 'on_table' || m.status === 'in_progress'));
  const busyEntries = new Set(
    matches.filter((m) => m.tableId && (m.status === 'on_table' || m.status === 'in_progress')).flatMap((m) => [m.red, m.blue]).filter((x): x is string => !!x),
  );
  // Lần cuối mỗi VĐV đấu xong
  const lastPlayed = new Map<string, number>();
  for (const m of matches) {
    if (m.status !== 'finished' || !m.finishedAt) continue;
    for (const e of [m.red, m.blue]) if (e) lastPlayed.set(e, Math.max(lastPlayed.get(e) ?? 0, m.finishedAt.getTime()));
  }
  // Hạng mỗi bàn đang/vừa đấu
  const affinity = new Map<string, string>();
  for (const m of [...matches].filter((x) => x.tableId).sort((a, b) => (a.finishedAt?.getTime() ?? Infinity) - (b.finishedAt?.getTime() ?? Infinity))) {
    affinity.set(m.tableId!, m.categoryId);
  }

  let pool = matches.filter((m) => m.status === 'ready' && !m.tableId && m.bracketLive && m.red && m.blue);
  const rested = (m: SchedMatch) => [m.red!, m.blue!].every((e) => now.getTime() - (lastPlayed.get(e) ?? 0) >= REST_MS);
  const free = (m: SchedMatch) => !busyEntries.has(m.red!) && !busyEntries.has(m.blue!);

  const load = new Map(tables.map((t) => [t.id, queued(t.id)]));
  const nextPos = new Map(tables.map((t) => [t.id, Math.max(0, ...(load.get(t.id) ?? []).map((m) => m.queuePosition ?? 0)) + 1]));

  // Lặp: mỗi lượt gán 1 trận cho bàn đang ít trận nhất
  for (let guard = 0; guard < 500; guard++) {
    const open = tables
      .filter((t) => t.active && (load.get(t.id)?.length ?? 0) + out.filter((a) => a.tableId === t.id).length < QUEUE_DEPTH)
      .sort((a, b) => (load.get(a.id)!.length + out.filter((x) => x.tableId === a.id).length) - (load.get(b.id)!.length + out.filter((x) => x.tableId === b.id).length) || a.sortOrder - b.sortOrder);
    const table = open[0];
    if (!table) break;
    const candidates = pool.filter(free);
    if (!candidates.length) break;
    const sessionKey = (m: SchedMatch) => m.sessionStart?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const earliest = Math.min(...candidates.map(sessionKey));
    const inSession = candidates.filter((m) => sessionKey(m) === earliest);
    const restedOnes = inSession.filter(rested);
    const choices = restedOnes.length ? restedOnes : inSession;
    const aff = affinity.get(table.id);
    const pick = [...choices].sort(
      (a, b) => Number(b.categoryId === aff) - Number(a.categoryId === aff) || a.categoryOrder - b.categoryOrder || a.number - b.number,
    )[0]!;
    const pos = nextPos.get(table.id)!;
    out.push({ matchId: pick.id, tableId: table.id, queuePosition: pos });
    nextPos.set(table.id, pos + 1);
    affinity.set(table.id, pick.categoryId);
    busyEntries.add(pick.red!);
    busyEntries.add(pick.blue!);
    pool = pool.filter((m) => m.id !== pick.id);
  }
  return out;
}
