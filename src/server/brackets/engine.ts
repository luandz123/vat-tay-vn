/**
 * Engine bảng đấu (thuần, không DB).
 *
 * Mô hình: "khung" (skeleton) gồm các trận và con trỏ tiến trận (người thắng → nextMatch/nextSlot,
 * người thua → loserNext/loserNextSlot) + VĐV ở vòng 1. Trạng thái mọi trận được TÍNH LẠI từ khung
 * và danh sách kết quả (matchId → người thắng). Nhờ vậy ghi kết quả, hoàn tác, đổi vị trí đều nhất quán.
 */
export type Side = 'winners' | 'losers' | 'grand_final' | 'third_place';
export type Slot = 'red' | 'blue';

export interface SkeletonMatch {
  key: string;
  side: Side;
  round: number;
  position: number;
  number: number; // "Trận 5" — thứ tự hiển thị/đấu trong hạng
  red: string | null; // chỉ có ở vòng 1 nhánh thắng (VĐV được bốc thăm)
  blue: string | null;
  next: string | null;
  nextSlot: Slot | null;
  loserNext: string | null;
  loserNextSlot: Slot | null;
}

export type MatchStatus = 'pending' | 'ready' | 'finished' | 'bye' | 'skipped';

export interface MatchState extends SkeletonMatch {
  status: MatchStatus;
  winner: string | null;
  loser: string | null;
}

export interface BracketOptions {
  type: 'single' | 'double';
  thirdPlaceMatch: boolean;
  grandFinalReset: boolean;
}

/* ───────────── Bốc thăm ───────────── */

/** PRNG có seed (mulberry32) để bốc thăm tái lập được khi kiểm tra. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Thứ tự hạt giống chuẩn: size 8 → [1,8,4,5,2,7,3,6]. Bye (hạt giống > n) luôn gặp người có thật. */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n + 1 - s]);
  }
  return order;
}

/* ───────────── Sinh khung ───────────── */

export function generateSkeleton(entries: readonly string[], opts: BracketOptions): SkeletonMatch[] {
  const n = entries.length;
  if (n < 2) return [];
  let R = 0;
  while (2 ** R < n) R++;
  const size = 2 ** R;
  const ms: SkeletonMatch[] = [];
  const key = (side: Side, round: number, pos: number) => `${side[0]}${round}-${pos}`;
  const add = (side: Side, round: number, position: number) =>
    ms.push({ key: key(side, round, position), side, round, position, number: 0, red: null, blue: null, next: null, nextSlot: null, loserNext: null, loserNextSlot: null });

  // Nhánh thắng
  for (let r = 1; r <= R; r++) for (let p = 0; p < size / 2 ** r; p++) add('winners', r, p);
  const order = seedOrder(size);
  const get = (k: string) => ms.find((m) => m.key === k)!;
  for (let p = 0; p < size / 2; p++) {
    const m = get(key('winners', 1, p));
    const a = order[2 * p]!;
    const b = order[2 * p + 1]!;
    m.red = a <= n ? entries[a - 1]! : null;
    m.blue = b <= n ? entries[b - 1]! : null;
  }
  for (let r = 1; r < R; r++)
    for (let p = 0; p < size / 2 ** r; p++) {
      const m = get(key('winners', r, p));
      m.next = key('winners', r + 1, Math.floor(p / 2));
      m.nextSlot = p % 2 === 0 ? 'red' : 'blue';
    }

  if (opts.type === 'single') {
    if (opts.thirdPlaceMatch && R >= 2) {
      add('third_place', 1, 0);
      for (let p = 0; p < 2; p++) {
        const semi = get(key('winners', R - 1, p));
        semi.loserNext = key('third_place', 1, 0);
        semi.loserNextSlot = p === 0 ? 'red' : 'blue';
      }
    }
  } else {
    // Nhánh thua: 2(R-1) vòng
    const LR = 2 * (R - 1);
    const lbCount = (lr: number) => size / 2 ** (Math.floor((lr + 1) / 2) + 1);
    for (let lr = 1; lr <= LR; lr++) for (let p = 0; p < lbCount(lr); p++) add('losers', lr, p);
    add('grand_final', 1, 0);
    if (opts.grandFinalReset) add('grand_final', 2, 0);

    // Người thua nhánh thắng rơi xuống
    for (let p = 0; p < size / 2; p++) {
      const m = get(key('winners', 1, p));
      if (R === 1) {
        m.loserNext = key('grand_final', 1, 0);
        m.loserNextSlot = 'blue';
      } else {
        m.loserNext = key('losers', 1, Math.floor(p / 2));
        m.loserNextSlot = p % 2 === 0 ? 'red' : 'blue';
      }
    }
    for (let r = 2; r <= R; r++) {
      const count = size / 2 ** r;
      for (let j = 0; j < count; j++) {
        const m = get(key('winners', r, j));
        const lr = 2 * (r - 1);
        const pos = r % 2 === 0 ? count - 1 - j : j; // đảo chiều xen kẽ để hạn chế gặp lại sớm
        m.loserNext = key('losers', lr, pos);
        m.loserNextSlot = 'blue';
      }
    }
    // Tiến trong nhánh thua
    for (let lr = 1; lr < LR; lr++)
      for (let p = 0; p < lbCount(lr); p++) {
        const m = get(key('losers', lr, p));
        if (lr % 2 === 1) {
          m.next = key('losers', lr + 1, p);
          m.nextSlot = 'red';
        } else {
          m.next = key('losers', lr + 1, Math.floor(p / 2));
          m.nextSlot = p % 2 === 0 ? 'red' : 'blue';
        }
      }
    get(key('winners', R, 0)).next = key('grand_final', 1, 0);
    get(key('winners', R, 0)).nextSlot = 'red';
    if (LR > 0) {
      const lbFinal = get(key('losers', LR, 0));
      lbFinal.next = key('grand_final', 1, 0);
      lbFinal.nextSlot = 'blue';
    }
  }

  // Đánh số trận theo thứ tự nên đấu: vòng nhỏ trước, xen nhánh thắng/thua
  const rank = (m: SkeletonMatch) => {
    // Nhánh thắng vòng r phải đấu trước vòng thua 2(r-1) (nơi nhận người thua của nó)
    if (m.side === 'winners') return 2 * (m.round - 1) - 0.5;
    if (m.side === 'losers') return m.round;
    if (m.side === 'third_place') return 1000;
    return 2000 + m.round;
  };
  [...ms]
    .sort((a, b) => rank(a) - rank(b) || a.position - b.position)
    .forEach((m, i) => (m.number = i + 1));
  return ms.sort((a, b) => a.number - b.number);
}

/* ───────────── Tính trạng thái ───────────── */

type SlotState = { kind: 'filled'; entry: string } | { kind: 'pending' } | { kind: 'dead' };

/**
 * Tính trạng thái toàn bảng từ khung + kết quả. Kết quả không hợp lệ (người thắng không có trong trận)
 * bị bỏ qua. Chung kết đấu lại: nếu người nhánh thắng (red) thắng trận 1 thì trận 2 'skipped'.
 */
export function computeState(skeleton: readonly SkeletonMatch[], results: ReadonlyMap<string, string>): MatchState[] {
  const byKey = new Map(skeleton.map((m) => [m.key, m]));
  const feeders = new Map<string, { red: { from: string; kind: 'winner' | 'loser' }[]; blue: { from: string; kind: 'winner' | 'loser' }[] }>();
  for (const m of skeleton) feeders.set(m.key, { red: [], blue: [] });
  for (const m of skeleton) {
    if (m.next && m.nextSlot) feeders.get(m.next)![m.nextSlot].push({ from: m.key, kind: 'winner' });
    if (m.loserNext && m.loserNextSlot) feeders.get(m.loserNext)![m.loserNextSlot].push({ from: m.key, kind: 'loser' });
  }
  const gf1 = skeleton.find((m) => m.side === 'grand_final' && m.round === 1);
  const gf2 = skeleton.find((m) => m.side === 'grand_final' && m.round === 2);

  const state = new Map<string, MatchState>();
  const visiting = new Set<string>();

  const slot = (m: SkeletonMatch, s: Slot): SlotState => {
    const seeded = s === 'red' ? m.red : m.blue;
    if (m.side === 'winners' && m.round === 1) return seeded ? { kind: 'filled', entry: seeded } : { kind: 'dead' };
    if (gf2 && m.key === gf2.key && gf1) {
      // Trận đấu lại: chỉ có khi người nhánh thua (blue) thắng trận 1
      const g = resolve(gf1.key);
      if (g.status !== 'finished') return g.status === 'skipped' || g.status === 'bye' ? { kind: 'dead' } : { kind: 'pending' };
      if (g.winner === g.red) return { kind: 'dead' };
      const e = s === 'red' ? g.red : g.blue;
      return e ? { kind: 'filled', entry: e } : { kind: 'dead' };
    }
    const fs = feeders.get(m.key)![s];
    if (fs.length === 0) return { kind: 'dead' };
    const f = fs[0]!;
    const src = resolve(f.from);
    if (src.status === 'pending' || src.status === 'ready') return { kind: 'pending' };
    const e = f.kind === 'winner' ? src.winner : src.loser;
    return e ? { kind: 'filled', entry: e } : { kind: 'dead' };
  };

  function resolve(key: string): MatchState {
    const done = state.get(key);
    if (done) return done;
    if (visiting.has(key)) throw new Error(`Vòng lặp trong bảng đấu tại ${key}`);
    visiting.add(key);
    const m = byKey.get(key)!;
    const r = slot(m, 'red');
    const b = slot(m, 'blue');
    const red = r.kind === 'filled' ? r.entry : null;
    const blue = b.kind === 'filled' ? b.entry : null;
    let st: MatchState;
    if (r.kind === 'dead' && b.kind === 'dead') st = { ...m, red, blue, status: m === gf2 ? 'skipped' : 'bye', winner: null, loser: null };
    else if (r.kind === 'dead' || b.kind === 'dead') {
      const other = r.kind === 'dead' ? b : r;
      st =
        other.kind === 'filled'
          ? { ...m, red, blue, status: 'bye', winner: other.entry, loser: null }
          : { ...m, red, blue, status: 'pending', winner: null, loser: null };
    } else if (r.kind === 'pending' || b.kind === 'pending') st = { ...m, red, blue, status: 'pending', winner: null, loser: null };
    else {
      const w = results.get(key);
      if (w && (w === red || w === blue)) st = { ...m, red, blue, status: 'finished', winner: w, loser: w === red ? blue : red };
      else st = { ...m, red, blue, status: 'ready', winner: null, loser: null };
    }
    visiting.delete(key);
    state.set(key, st);
    return st;
  }

  return skeleton.map((m) => resolve(m.key));
}

/* ───────────── Hoàn tác ───────────── */

/**
 * Hoàn tác được khi không trận nào phía sau (nhận người thắng/thua của trận này) đã có kết quả.
 * Trận đấu lại chung kết phụ thuộc trận 1.
 */
export function canUndo(states: readonly MatchState[], key: string): boolean {
  const m = states.find((x) => x.key === key);
  if (!m || m.status !== 'finished') return false;
  const downstream = [m.next, m.loserNext].filter((k): k is string => !!k);
  if (m.side === 'grand_final' && m.round === 1) {
    const r2 = states.find((x) => x.side === 'grand_final' && x.round === 2);
    if (r2) downstream.push(r2.key);
  }
  return downstream.every((k) => {
    const d = states.find((x) => x.key === k)!;
    if (d.status === 'finished') return false;
    if (d.status === 'bye') return canUndoBye(states, d);
    return true;
  });
}

function canUndoBye(states: readonly MatchState[], m: MatchState): boolean {
  return [m.next, m.loserNext]
    .filter((k): k is string => !!k)
    .every((k) => {
      const d = states.find((x) => x.key === k)!;
      return d.status !== 'finished' && (d.status !== 'bye' || canUndoBye(states, d));
    });
}

/* ───────────── Xếp hạng ───────────── */

export interface Placing {
  entry: string;
  place: number; // 1 vàng, 2 bạc, 3 đồng, 4 = khuyến khích
}

/** Xếp hạng cuối khi bảng đã xong; null nếu chưa xong. */
export function finalPlacings(states: readonly MatchState[], opts: BracketOptions): Placing[] | null {
  if (states.length === 0) return null;
  if (states.some((m) => m.status === 'pending' || m.status === 'ready')) return null;
  const out: Placing[] = [];
  const push = (entry: string | null, place: number) => {
    if (entry && !out.some((p) => p.entry === entry)) out.push({ entry, place });
  };
  if (opts.type === 'single') {
    const final = states.filter((m) => m.side === 'winners').sort((a, b) => b.round - a.round)[0]!;
    push(final.winner, 1);
    push(final.loser, 2);
    const third = states.find((m) => m.side === 'third_place');
    if (third && third.status === 'finished') {
      push(third.winner, 3);
      push(third.loser, 4);
    } else {
      const R = final.round;
      for (const semi of states.filter((m) => m.side === 'winners' && m.round === R - 1)) push(semi.loser, 3);
      if (third?.status === 'bye') push(third.winner, 3);
    }
  } else {
    const gf = states.filter((m) => m.side === 'grand_final').sort((a, b) => b.round - a.round);
    const decisive = gf.find((m) => m.status === 'finished') ?? gf.find((m) => m.status === 'bye');
    if (!decisive) return null;
    push(decisive.winner, 1);
    push(decisive.status === 'finished' ? decisive.loser : null, 2);
    const lb = states.filter((m) => m.side === 'losers').sort((a, b) => b.round - a.round);
    const lbFinal = lb[0];
    if (lbFinal) push(lbFinal.loser, 3);
    const lbSemi = lb.filter((m) => lbFinal && m.round === lbFinal.round - 1);
    for (const m of lbSemi) push(m.loser, 4);
    if (!lbFinal) {
      // 2 VĐV: người thua trận chung kết nhánh thắng là hạng 2 (đã đẩy ở trên)
    }
  }
  return out;
}

/** Người thắng của một trận theo góc (tiện cho UI). */
export const entryAt = (m: Pick<MatchState, 'red' | 'blue'>, s: Slot) => (s === 'red' ? m.red : m.blue);
