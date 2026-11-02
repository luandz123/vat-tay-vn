import { describe, expect, it } from 'vitest';
import { buildSharePost } from './share-post';

describe('buildSharePost', () => {
  it('đủ các phần chính', () => {
    const text = buildSharePost({
      name: 'Giải vật tay PTIT 2026',
      startsAt: new Date('2026-12-15T00:00:00Z'),
      venueName: 'Nhà thi đấu PTIT',
      venueAddress: null,
      registrationDeadline: null,
      url: 'https://vattay.vn/ptit-2026',
      categories: [
        { hand: 'right', gender: 'male', label: '-63kg', kind: 'weight' },
        { hand: 'right', gender: 'male', label: '-73kg', kind: 'weight' },
        { hand: 'left', gender: 'female', label: '-55kg', kind: 'weight' },
      ],
      priceTiers: [{ kind: 'online', name: 'Online', singleHandPrice: 150000, bothHandsPrice: 250000 }],
      prizes: [{ title: 'Nhất', description: 'HCV + 1.000.000đ' }],
      contactPhone: '0912345678',
    });
    expect(text).toContain('GIẢI VẬT TAY PTIT 2026');
    expect(text).toContain('07:00 · Thứ Ba 15.12.2026');
    expect(text).toContain('• Tay phải · Nam: -63kg, -73kg');
    expect(text).toContain('• Online: 150.000đ/tay · combo 2 tay 250.000đ');
    expect(text).toContain('https://vattay.vn/ptit-2026');
  });
});
