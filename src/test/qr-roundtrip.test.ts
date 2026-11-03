import jsQR from 'jsqr';
import QRCode from 'qrcode';
import { describe, expect, it } from 'vitest';

/** Mã QR vé do app sinh (thư viện qrcode) phải đọc được bằng jsQR (máy quét dự phòng cho iPhone). */
describe('QR vé', () => {
  it('jsQR đọc được link vé', () => {
    const url = 'https://vat-tay-vn.vercel.app/ve/Le136v5I-giS9ZYiQZR49V_0';
    const qr = QRCode.create(url, { errorCorrectionLevel: 'M' });
    const scale = 6;
    const margin = 4;
    const size = (qr.modules.size + margin * 2) * scale;
    const data = new Uint8ClampedArray(size * size * 4).fill(255);
    for (let y = 0; y < qr.modules.size; y++)
      for (let x = 0; x < qr.modules.size; x++) {
        if (!qr.modules.get(y, x)) continue;
        for (let dy = 0; dy < scale; dy++)
          for (let dx = 0; dx < scale; dx++) {
            const i = (((y + margin) * scale + dy) * size + (x + margin) * scale + dx) * 4;
            data[i] = data[i + 1] = data[i + 2] = 0;
          }
      }
    expect(jsQR(data, size, size)?.data).toBe(url);
  });
});
