import { describe, expect, it } from 'vitest';
import { crc16, sanitizeTransferContent, vietQrPayload } from './vietqr';

describe('VietQR', () => {
  it('CRC16-CCITT-FALSE chuẩn', () => expect(crc16('123456789')).toBe('29B1'));
  it('nội dung CK bỏ dấu, viết hoa', () => expect(sanitizeTransferContent('VTK7Q2 Nguyễn Đức-Anh!')).toBe('VTK7Q2 NGUYEN DUC ANH'));
  it('cấu trúc payload', () => {
    const p = vietQrPayload({ bankBin: '970436', accountNo: '0123456789', amount: 250000, content: 'VTK7Q2M9' });
    expect(p.startsWith('000201010212')).toBe(true);
    expect(p).toContain('0010A000000727');
    expect(p).toContain('0006970436');
    expect(p).toContain('01100123456789');
    expect(p).toContain('0208QRIBFTTA');
    expect(p).toContain('5303704');
    expect(p).toContain('5406250000');
    expect(p).toContain('5802VN');
    expect(p).toContain('62120808VTK7Q2M9');
    expect(p.slice(-8, -4)).toBe('6304');
    expect(crc16(p.slice(0, -4))).toBe(p.slice(-4));
  });
  it('không có số tiền thì là QR tĩnh', () => expect(vietQrPayload({ bankBin: '970436', accountNo: '1234' }).slice(6, 12)).toBe('010211'));
});
