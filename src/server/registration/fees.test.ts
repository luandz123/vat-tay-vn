import { describe, expect, it } from 'vitest';
import { additionalFee, paymentStatusOf, pickPriceTier, totalFee } from './fees';

const online = { singleHandPrice: 150_000, bothHandsPrice: 250_000 };
const onsite = { singleHandPrice: 200_000, bothHandsPrice: 320_000 };

describe('totalFee', () => {
  it('1 tay', () => expect(totalFee([{ hand: 'right' }], online)).toBe(150_000));
  it('2 tay được combo', () => expect(totalFee([{ hand: 'right' }, { hand: 'left' }], online)).toBe(250_000));
  it('không có combo thì cộng thẳng', () =>
    expect(totalFee([{ hand: 'right' }, { hand: 'left' }], { singleHandPrice: 100_000, bothHandsPrice: null })).toBe(200_000));
  it('2 hạng cùng tay không được combo', () => expect(totalFee([{ hand: 'right' }, { hand: 'right' }], online)).toBe(300_000));
  it('3 hạng (2 phải + 1 trái) giảm combo một lần', () =>
    expect(totalFee([{ hand: 'right' }, { hand: 'right' }, { hand: 'left' }], online)).toBe(400_000));
  it('Toàn năng tự thêm không tính phí', () =>
    expect(totalFee([{ hand: 'right' }, { hand: 'right', autoAdded: true }], online)).toBe(150_000));
  it('combo đắt hơn 2 lần giá lẻ thì không tăng giá', () =>
    expect(totalFee([{ hand: 'right' }, { hand: 'left' }], { singleHandPrice: 100_000, bothHandsPrice: 250_000 })).toBe(200_000));
});

describe('additionalFee', () => {
  it('online tay phải, thêm tay trái tại sân: 320k − 150k = 170k', () =>
    expect(additionalFee([{ hand: 'right' }], [{ hand: 'left' }], 150_000, onsite)).toBe(170_000));
  it('không bao giờ âm', () =>
    expect(additionalFee([{ hand: 'right' }], [{ hand: 'left' }], 400_000, online)).toBe(0));
});

describe('paymentStatusOf', () => {
  it('chưa đóng', () => expect(paymentStatusOf(150_000, 0)).toBe('unpaid'));
  it('đóng thiếu sau khi thêm hạng', () => expect(paymentStatusOf(320_000, 150_000)).toBe('partial'));
  it('đủ', () => expect(paymentStatusOf(150_000, 150_000)).toBe('paid'));
});

describe('pickPriceTier', () => {
  const tiers = [
    { id: 'early', kind: 'online' as const, validUntil: new Date('2026-12-10T16:59:59Z'), sortOrder: 0 },
    { id: 'late', kind: 'online' as const, validUntil: null, sortOrder: 1 },
    { id: 'door', kind: 'onsite' as const, validUntil: null, sortOrder: 0 },
  ];
  it('còn hạn đợt sớm', () => expect(pickPriceTier(tiers, 'online', new Date('2026-12-01'))?.id).toBe('early'));
  it('hết hạn chuyển đợt sau', () => expect(pickPriceTier(tiers, 'online', new Date('2026-12-11'))?.id).toBe('late'));
  it('tại sân', () => expect(pickPriceTier(tiers, 'onsite', new Date('2026-12-15'))?.id).toBe('door'));
});
