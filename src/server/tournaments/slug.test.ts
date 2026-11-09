import { describe, expect, it } from 'vitest';
import { codePrefixFrom, isValidSlug, slugify, uniqueSlug } from './slug';

describe('slug', () => {
  it('bỏ dấu tiếng Việt', () => expect(slugify('Giải vật tay PTIT mở rộng 2026')).toBe('giai-vat-tay-ptit-mo-rong-2026'));
  it('chữ đ', () => expect(slugify('Đấu trường Đông Đô')).toBe('dau-truong-dong-do'));
  it('ký tự lạ', () => expect(slugify('  Cúp #1 — Hà Nội!! ')).toBe('cup-1-ha-noi'));
  it('chặn slug hệ thống', () => expect(isValidSlug('btc')).toBe(false));
  it('slug hợp lệ', () => expect(isValidSlug('ptit-2026')).toBe(true));
  it('thêm hậu tố khi trùng', () => expect(uniqueSlug('ptit-2026', new Set(['ptit-2026', 'ptit-2026-2']))).toBe('ptit-2026-3'));
  it('slug dành riêng được đổi', () => expect(uniqueSlug('admin', new Set())).toBe('giai-admin'));
  it('tiền tố mã', () => expect(codePrefixFrom('Giải vật tay PTIT mở rộng', 2026)).toBe('PT26'));
  it('tiền tố mặc định', () => expect(codePrefixFrom('Giải vật tay', 2027)).toBe('VT27'));
});

import { finalizeSlug, slugTyping } from './slug';
describe('gõ link', () => {
  it('giữ dấu gạch cuối khi đang gõ', () => expect(slugTyping('ptit-')).toBe('ptit-'));
  it('gõ có dấu và khoảng trắng', () => expect(slugTyping('Giải Đông Đô ')).toBe('giai-dong-do-'));
  it('chốt khi lưu', () => expect(finalizeSlug('ptit-2026-')).toBe('ptit-2026'));
});
