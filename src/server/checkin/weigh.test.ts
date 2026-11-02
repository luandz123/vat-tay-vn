import { describe, expect, it } from 'vitest';
import { evaluateWeigh, parseKg, type WeightClass } from './weigh';

const c = (id: string, max: number | null, min: number | null = null, hand: 'left' | 'right' = 'right'): WeightClass => ({
  id, hand, gender: 'male', label: id, weightMinKg: min, weightMaxKg: max, sortOrder: 0,
});
const classes = [c('-57', 57), c('-63', 63), c('-73', 73), c('+73', null, 73), c('L-63', 63, null, 'left')];

describe('xét cân', () => {
  it('đạt nhờ dung sai', () => {
    const v = evaluateWeigh(63.8, classes[1]!, classes, 1);
    expect(v).toMatchObject({ pass: true, limitKg: 64, marginKg: 0.2, suggestion: null });
  });
  it('đúng bằng giới hạn vẫn đạt', () => expect(evaluateWeigh(64, classes[1]!, classes, 1).pass).toBe(true));
  it('vượt → gợi ý hạng cùng tay nhỏ nhất phù hợp', () => {
    const v = evaluateWeigh(64.6, classes[1]!, classes, 1);
    expect(v.pass).toBe(false);
    expect(v.marginKg).toBe(-0.6);
    expect(v.suggestion?.id).toBe('-73');
  });
  it('quá nặng → ngoại hạng', () => expect(evaluateWeigh(80, classes[2]!, classes, 0).suggestion?.id).toBe('+73'));
  it('ngoại hạng luôn đạt', () => expect(evaluateWeigh(120, classes[3]!, classes, 0)).toMatchObject({ pass: true, limitKg: null }));
  it('không gợi ý hạng tay khác', () => expect(evaluateWeigh(64.6, classes[4]!, classes, 0).suggestion).toBeNull());
  it('đọc số cân', () => {
    expect(parseKg('64,6')).toBe(64.6);
    expect(parseKg('abc')).toBeNull();
    expect(parseKg('5')).toBeNull();
  });
});
