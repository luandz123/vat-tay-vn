import { describe, expect, it } from 'vitest';
import {
  allocateFees,
  cleanFullName,
  findTransferRef,
  formatPhone,
  genderFits,
  isOutsideBirthYears,
  maskPhone,
  newTransferRef,
  normalizeName,
  normalizePhone,
} from './rules';

describe('SĐT', () => {
  it.each([
    ['0912 345 678', '+84912345678'],
    ['+84 912345678', '+84912345678'],
    ['84912345678', '+84912345678'],
    ['0387.123.456', '+84387123456'],
  ])('%s', (a, b) => expect(normalizePhone(a)).toBe(b));
  it.each(['12345', '0212345678', '091234567', 'abc'])('không hợp lệ: %s', (a) => expect(normalizePhone(a)).toBeNull());
  it('che số', () => expect(maskPhone('+84912345678')).toBe('0912 *** 678'));
  it('hiển thị', () => expect(formatPhone('+84912345678')).toBe('0912 345 678'));
});

describe('tên', () => {
  it('chuẩn hóa', () => expect(cleanFullName('  nguyễn   MINH khang ')).toBe('Nguyễn Minh Khang'));
  it('so trùng', () => expect(normalizeName('Đỗ  hải LONG')).toBe('do hai long'));
});

describe('năm sinh & giới tính', () => {
  const t = { birthYearMin: 1996, birthYearMax: 2008 };
  const none = { birthYearMin: null, birthYearMax: null };
  it('trong giới hạn', () => expect(isOutsideBirthYears(2000, none, t)).toBe(false));
  it('ngoài giới hạn giải', () => expect(isOutsideBirthYears(2009, none, t)).toBe(true));
  it('hạng riêng ưu tiên', () => expect(isOutsideBirthYears(2009, { birthYearMin: null, birthYearMax: 2012 }, t)).toBe(false));
  it('không giới hạn', () => expect(isOutsideBirthYears(1950, none, none)).toBe(false));
  it('giới tính', () => {
    expect(genderFits('female', 'open')).toBe(true);
    expect(genderFits('female', 'male')).toBe(false);
  });
});

describe('chia phí', () => {
  it('combo 2 tay 250k', () => expect(allocateFees(2, 250000, 150000)).toEqual([150000, 100000]));
  it('1 tay', () => expect(allocateFees(1, 150000, 150000)).toEqual([150000]));
  it('thêm tay thứ 2 tại sân 170k', () => expect(allocateFees(1, 170000, 200000)).toEqual([170000]));
  it('miễn phí', () => expect(allocateFees(2, 0, 0)).toEqual([0, 0]));
});

describe('mã chuyển khoản', () => {
  it('định dạng', () => expect(newTransferRef()).toMatch(/^VT[A-HJ-NP-Z2-9]{6}$/));
  it('tìm trong nội dung ngân hàng', () => {
    expect(findTransferRef('MBVCB.123.VTK7Q2M9 Nguyen Van A chuyen tien')).toBe('VTK7Q2M9');
    expect(findTransferRef('vt k7q2 m9')).toBe('VTK7Q2M9');
    expect(findTransferRef('chuyen tien')).toBeNull();
  });
});
