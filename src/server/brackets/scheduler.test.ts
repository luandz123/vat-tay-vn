import { describe, expect, it } from 'vitest';
import { planAssignments, type SchedMatch, type SchedTable } from './scheduler';

const NOW = new Date('2026-11-03T03:00:00Z');
const T = (id: string, sortOrder: number, active = true): SchedTable => ({ id, sortOrder, active });
let n = 0;
const M = (o: Partial<SchedMatch>): SchedMatch => ({
  id: `m${++n}`, categoryId: 'c1', number: n, status: 'ready', tableId: null, queuePosition: null,
  red: `r${n}`, blue: `b${n}`, winner: null, finishedAt: null, bracketLive: true, sessionStart: null, categoryOrder: 0, ...o,
});

describe('tự gán bàn', () => {
  it('mỗi bàn tối đa 2 trận, chia đều giữa các bàn', () => {
    const ms = Array.from({ length: 6 }, () => M({}));
    const a = planAssignments([T('t1', 0), T('t2', 1)], ms, NOW);
    expect(a).toHaveLength(4);
    expect(a.filter((x) => x.tableId === 't1')).toHaveLength(2);
    expect(a.filter((x) => x.tableId === 't2')).toHaveLength(2);
    expect(a.map((x) => x.matchId)).toEqual(['m1', 'm2', 'm3', 'm4']); // số trận nhỏ trước
  });

  it('không gán vào bàn tạm nghỉ, không gán bảng nháp', () => {
    const ms = [M({ bracketLive: false }), M({})];
    const a = planAssignments([T('t1', 0, false), T('t2', 1)], ms, NOW);
    expect(a).toEqual([{ matchId: ms[1]!.id, tableId: 't2', queuePosition: 1 }]);
  });

  it('bàn đã đủ trận thì không gán thêm; nối tiếp vị trí hàng chờ', () => {
    const busy = M({ status: 'in_progress', tableId: 't1', queuePosition: 4 });
    const a = planAssignments([T('t1', 0)], [busy, M({}), M({})], NOW);
    expect(a).toHaveLength(1);
    expect(a[0]!.queuePosition).toBe(5);
  });

  it('một VĐV không ở 2 bàn cùng lúc', () => {
    const a1 = M({ red: 'x', blue: 'y' });
    const a2 = M({ red: 'x', blue: 'z' });
    const a3 = M({});
    const out = planAssignments([T('t1', 0), T('t2', 1)], [a1, a2, a3], NOW);
    expect(out.map((o) => o.matchId).sort()).toEqual([a1.id, a3.id].sort());
  });

  it('ưu tiên VĐV đã nghỉ đủ 5 phút, nhưng vẫn gán nếu không còn trận khác', () => {
    const recent = M({ status: 'finished', red: 'tired', blue: 'q', winner: 'tired', finishedAt: new Date(NOW.getTime() - 60_000) });
    const tiredMatch = M({ red: 'tired', blue: 'w' });
    const freshMatch = M({});
    const out = planAssignments([T('t1', 0)], [recent, tiredMatch, freshMatch], NOW);
    expect(out[0]!.matchId).toBe(freshMatch.id);
    expect(out[1]!.matchId).toBe(tiredMatch.id); // chỉ còn trận này
  });

  it('phiên sớm hơn trước; bàn giữ hạng đang đấu', () => {
    const morning = new Date('2026-11-03T01:30:00Z');
    const afternoon = new Date('2026-11-03T07:00:00Z');
    const late = M({ categoryId: 'pm', sessionStart: afternoon, number: 1 });
    const early = M({ categoryId: 'am', sessionStart: morning, number: 9 });
    expect(planAssignments([T('t1', 0)], [late, early], NOW)[0]!.matchId).toBe(early.id);

    const doneOnT1 = M({ categoryId: 'B', status: 'finished', tableId: 't1', finishedAt: NOW, red: 'p', blue: 'q', winner: 'p' });
    const catA = M({ categoryId: 'A', number: 1, categoryOrder: 0 });
    const catB = M({ categoryId: 'B', number: 5, categoryOrder: 1 });
    expect(planAssignments([T('t1', 0)], [doneOnT1, catA, catB], new Date(NOW.getTime() + 600_000))[0]!.matchId).toBe(catB.id);
  });
});
