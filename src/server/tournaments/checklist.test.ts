import { describe, expect, it } from 'vitest';
import { canPublish, publishChecklist, type ChecklistInput } from './checklist';

const base: ChecklistInput = {
  name: 'Giải PTIT',
  coverImageKey: 'tournaments/1/cover.jpg',
  startsAt: new Date('2026-12-15T00:00:00Z'),
  venueName: 'Nhà thi đấu PTIT',
  registrationDeadline: new Date('2026-12-12T16:59:00Z'),
  birthYearMin: 1996,
  birthYearMax: 2008,
  hasContact: true,
  hasBankInfo: true,
  categories: [
    { label: '-63kg', kind: 'weight', hand: 'right', gender: 'male', sessionId: 's1', weightMinKg: null, weightMaxKg: 63, sourceCount: 0 },
  ],
  priceTiers: [{ kind: 'online', singleHandPrice: 150000, bothHandsPrice: 250000, validUntil: null }],
  sessionsCount: 1,
  now: new Date('2026-11-02T00:00:00Z'),
};

describe('publishChecklist', () => {
  it('đủ thông tin thì không có lỗi', () => {
    const issues = publishChecklist(base);
    expect(issues).toEqual([]);
    expect(canPublish(issues)).toBe(true);
  });
  it('thiếu ảnh bìa và hạng mục thì chặn', () => {
    const issues = publishChecklist({ ...base, coverImageKey: null, categories: [] });
    expect(canPublish(issues)).toBe(false);
    expect(issues.filter((i) => i.level === 'error').map((i) => i.step)).toEqual(['thong-tin', 'hang-muc']);
  });
  it('thu phí mà chưa có tài khoản ngân hàng thì chặn', () =>
    expect(canPublish(publishChecklist({ ...base, hasBankInfo: false }))).toBe(false));
  it('miễn phí thì không cần tài khoản', () =>
    expect(
      canPublish(publishChecklist({ ...base, hasBankInfo: false, priceTiers: [{ kind: 'online', singleHandPrice: 0, bothHandsPrice: null, validUntil: null }] })),
    ).toBe(true));
  it('hạng chưa gán phiên chỉ cảnh báo', () => {
    const issues = publishChecklist({ ...base, categories: [{ ...base.categories[0]!, sessionId: null }] });
    expect(canPublish(issues)).toBe(true);
    expect(issues[0]).toMatchObject({ level: 'warning', step: 'lich-giai-thuong' });
  });
  it('hạn đăng ký sau ngày thi đấu chỉ cảnh báo', () => {
    const issues = publishChecklist({ ...base, registrationDeadline: new Date('2026-12-20T00:00:00Z') });
    expect(issues).toHaveLength(1);
    expect(issues[0]!.level).toBe('warning');
  });
});
