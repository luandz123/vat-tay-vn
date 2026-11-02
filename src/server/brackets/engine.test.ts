import { describe, expect, it } from 'vitest';
import { canUndo, computeState, finalPlacings, generateSkeleton, rng, seedOrder, shuffle, type BracketOptions, type MatchState, type SkeletonMatch } from './engine';

const players = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const SINGLE: BracketOptions = { type: 'single', thirdPlaceMatch: true, grandFinalReset: true };
const DOUBLE: BracketOptions = { type: 'double', thirdPlaceMatch: false, grandFinalReset: true };

/** Đấu hết bảng, người thắng chọn bởi `pick`. Trả trạng thái cuối và thứ tự trận đã đấu. */
function playOut(sk: SkeletonMatch[], pick: (m: MatchState) => string) {
  const results = new Map<string, string>();
  const played: MatchState[] = [];
  for (let guard = 0; guard < 500; guard++) {
    const st = computeState(sk, results);
    const ready = st.filter((m) => m.status === 'ready').sort((a, b) => a.number - b.number);
    if (!ready.length) return { st, played, results };
    const m = ready[0]!;
    results.set(m.key, pick(m));
    played.push(m);
  }
  throw new Error('không kết thúc');
}

describe('bốc thăm', () => {
  it('thứ tự hạt giống chuẩn', () => expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]));
  it('xáo trộn tái lập theo seed', () => expect(shuffle(players(6), rng(42))).toEqual(shuffle(players(6), rng(42))));
});

describe('loại đơn', () => {
  it.each([2, 3, 5, 6, 8, 11, 16, 23])('%i VĐV: đủ trận, không bye gặp bye, đấu xong có 1 vô địch', (n) => {
    const sk = generateSkeleton(players(n), SINGLE);
    const r1 = sk.filter((m) => m.side === 'winners' && m.round === 1);
    expect(r1.every((m) => m.red || m.blue)).toBe(true);
    const { st } = playOut(sk, (m) => m.red!);
    const losers = st.filter((m) => m.side === 'winners' && m.status === 'finished').map((m) => m.loser);
    expect(losers).toHaveLength(n - 1);
    expect(new Set(losers).size).toBe(n - 1); // mỗi người (trừ vô địch) thua đúng 1 lần ở nhánh chính
    const places = finalPlacings(st, SINGLE)!;
    expect(places.filter((p) => p.place === 1)).toHaveLength(1);
    expect(places.filter((p) => p.place === 2)).toHaveLength(1);
    if (n >= 4) expect(places.filter((p) => p.place === 3)).toHaveLength(1);
    if (n === 3) expect(places.filter((p) => p.place === 3)).toHaveLength(1); // trận tranh 3 là bye
  });

  it('không có trận tranh hạng 3 thì 2 HCĐ', () => {
    const opts = { ...SINGLE, thirdPlaceMatch: false };
    const { st } = playOut(generateSkeleton(players(8), opts), (m) => m.blue!);
    expect(finalPlacings(st, opts)!.filter((p) => p.place === 3)).toHaveLength(2);
  });

  it('chưa xong thì chưa có xếp hạng', () => {
    const sk = generateSkeleton(players(4), SINGLE);
    expect(finalPlacings(computeState(sk, new Map()), SINGLE)).toBeNull();
  });
});

describe('loại kép', () => {
  it.each([2, 3, 4, 5, 7, 8, 12, 16])('%i VĐV: ai cũng thua tối đa 2 lần, có vô địch', (n) => {
    const sk = generateSkeleton(players(n), DOUBLE);
    const r = rng(n);
    const { st, played } = playOut(sk, (m) => (r() < 0.5 ? m.red! : m.blue!));
    const losses = new Map<string, number>();
    for (const m of st.filter((x) => x.status === 'finished')) losses.set(m.loser!, (losses.get(m.loser!) ?? 0) + 1);
    const places = finalPlacings(st, DOUBLE)!;
    const champ = places.find((p) => p.place === 1)!.entry;
    expect(losses.get(champ) ?? 0).toBeLessThanOrEqual(1);
    for (const p of players(n).filter((x) => x !== champ)) {
      const l = losses.get(p) ?? 0;
      expect(l).toBeGreaterThanOrEqual(1);
      expect(l).toBeLessThanOrEqual(2);
    }
    expect(played.length).toBe(st.filter((m) => m.status === 'finished').length);
    expect(places.filter((p) => p.place === 2)).toHaveLength(1);
  });

  it('nhánh thắng thắng chung kết → trận đấu lại bị bỏ', () => {
    const sk = generateSkeleton(players(4), DOUBLE);
    const { st } = playOut(sk, (m) => (m.side === 'grand_final' ? m.red! : m.red!));
    expect(st.find((m) => m.side === 'grand_final' && m.round === 2)!.status).toBe('skipped');
  });

  it('nhánh thua thắng chung kết 1 → có trận đấu lại', () => {
    const sk = generateSkeleton(players(4), DOUBLE);
    const { st } = playOut(sk, (m) => (m.side === 'grand_final' && m.round === 1 ? m.blue! : m.red!));
    const gf2 = st.find((m) => m.side === 'grand_final' && m.round === 2)!;
    expect(gf2.status).toBe('finished');
    expect(finalPlacings(st, DOUBLE)!.find((p) => p.place === 1)!.entry).toBe(gf2.winner);
  });

  it('thứ tự số trận: người thua rơi xuống trước khi trận nhánh thua cần họ', () => {
    const sk = generateSkeleton(players(8), DOUBLE);
    for (const m of sk) {
      if (m.loserNext) expect(sk.find((x) => x.key === m.loserNext)!.number).toBeGreaterThan(m.number);
      if (m.next) expect(sk.find((x) => x.key === m.next)!.number).toBeGreaterThan(m.number);
    }
  });
});

describe('hoàn tác', () => {
  it('hoàn tác được trận cuối, không hoàn tác được trận đã có trận sau đấu xong', () => {
    const sk = generateSkeleton(players(4), SINGLE);
    const results = new Map<string, string>();
    let st = computeState(sk, results);
    const [a, b] = st.filter((m) => m.status === 'ready');
    results.set(a!.key, a!.red!);
    results.set(b!.key, b!.red!);
    st = computeState(sk, results);
    expect(canUndo(st, a!.key)).toBe(true);
    const final = st.find((m) => m.side === 'winners' && m.round === 2)!;
    results.set(final.key, final.red!);
    st = computeState(sk, results);
    expect(canUndo(st, a!.key)).toBe(false);
    expect(canUndo(st, final.key)).toBe(true);
    results.delete(final.key);
    expect(computeState(sk, results).find((m) => m.key === final.key)!.status).toBe('ready');
  });

  it('kết quả không hợp lệ (người không có trong trận) bị bỏ qua', () => {
    const sk = generateSkeleton(players(4), SINGLE);
    const st = computeState(sk, new Map([[sk[0]!.key, 'nguoi-la']]));
    expect(st[0]!.status).toBe('ready');
  });
});
