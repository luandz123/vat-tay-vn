import { describe, expect, it } from 'vitest';
import { formatDateTime, formatDayDate, formatVnd, parseVnLocal, toVnLocal } from './time';

describe('giờ VN', () => {
  it('parse giờ VN thành UTC', () => expect(parseVnLocal('2026-12-15T07:00')?.toISOString()).toBe('2026-12-15T00:00:00.000Z'));
  it('sai định dạng → null', () => expect(parseVnLocal('15/12/2026')).toBeNull());
  it('đi khứ hồi', () => expect(toVnLocal(parseVnLocal('2026-12-15T23:30'))).toBe('2026-12-15T23:30'));
  it('hiển thị', () => expect(formatDateTime(new Date('2026-12-15T00:00:00Z'))).toBe('07:00 · 15.12.2026'));
  it('thứ trong tuần', () => expect(formatDayDate(new Date('2026-12-15T00:00:00Z'))).toBe('Thứ Ba 15.12.2026'));
  it('tiền', () => expect(formatVnd(150000)).toBe('150.000đ'));
});
