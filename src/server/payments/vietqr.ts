/**
 * Sinh nội dung mã VietQR (chuẩn EMVCo / NAPAS 247) để mọi app ngân hàng quét được.
 * Không phụ thuộc dịch vụ ngoài: tự tạo chuỗi rồi vẽ QR ở client.
 */
const tlv = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`;

/** CRC16-CCITT (FALSE): poly 0x1021, init 0xFFFF. */
export function crc16(input: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(input)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Bỏ dấu, chỉ giữ chữ số/chữ cái/khoảng trắng — nhiều ngân hàng cắt ký tự lạ trong nội dung CK. */
export function sanitizeTransferContent(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'D')
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, 50);
}

export function vietQrPayload(p: { bankBin: string; accountNo: string; amount?: number; content?: string }): string {
  const merchant = tlv('00', 'A000000727') + tlv('01', tlv('00', p.bankBin) + tlv('01', p.accountNo)) + tlv('02', 'QRIBFTTA');
  let s = tlv('00', '01') + tlv('01', p.amount ? '12' : '11') + tlv('38', merchant) + tlv('53', '704');
  if (p.amount) s += tlv('54', String(Math.round(p.amount)));
  s += tlv('58', 'VN');
  if (p.content) s += tlv('62', tlv('08', sanitizeTransferContent(p.content)));
  s += '6304';
  return s + crc16(s);
}
