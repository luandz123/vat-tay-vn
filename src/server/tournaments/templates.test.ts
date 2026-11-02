import { describe, expect, it } from 'vitest';
import { CATEGORY_TEMPLATES, categoriesFromTemplate, weightLabel } from './templates';

let n = 0;
const key = () => `k${++n}`;

describe('mẫu hạng cân', () => {
  it('nhãn', () => {
    expect(weightLabel(null, 63)).toBe('-63kg');
    expect(weightLabel(73, null)).toBe('+73kg');
    expect(weightLabel(null, 62.5)).toBe('-62.5kg');
  });
  it('sinh cho 2 tay, hạng cuối là ngoại hạng', () => {
    const cats = categoriesFromTemplate(CATEGORY_TEMPLATES[0]!, ['right', 'left'], key);
    expect(cats).toHaveLength(8);
    expect(cats.map((c) => c.label).slice(0, 4)).toEqual(['-57kg', '-63kg', '-73kg', '+73kg']);
    expect(cats[3]).toMatchObject({ weightMinKg: 73, weightMaxKg: null, hand: 'right', gender: 'male' });
    expect(cats[4]!.hand).toBe('left');
  });
});
