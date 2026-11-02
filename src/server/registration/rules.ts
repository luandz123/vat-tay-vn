/** Quy tắc đăng ký thuần (không DB): chuẩn hóa SĐT/tên, cảnh báo năm sinh, chia phí theo hạng, mã CK. */

/** "0912 345 678" / "+84912345678" / "84912345678" → "+84912345678"; null nếu không hợp lệ. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, '');
  let local: string;
  if (digits.startsWith('+84')) local = digits.slice(3);
  else if (digits.startsWith('84') && digits.length === 11) local = digits.slice(2);
  else if (digits.startsWith('0')) local = digits.slice(1);
  else return null;
  return /^[35789]\d{8}$/.test(local) ? `+84${local}` : null;
}

/** "+84912345678" → "0912 *** 678" (luôn che trên trang công khai). */
export function maskPhone(e164: string): string {
  const local = `0${e164.replace(/^\+84/, '')}`;
  return `${local.slice(0, 4)} *** ${local.slice(-3)}`;
}

/** "+84912345678" → "0912 345 678" (hiển thị cho chính VĐV và BTC). */
export function formatPhone(e164: string): string {
  const l = `0${e164.replace(/^\+84/, '')}`;
  return `${l.slice(0, 4)} ${l.slice(4, 7)} ${l.slice(7)}`;
}

/** Chuẩn hóa họ tên: gọn khoảng trắng, viết hoa chữ đầu mỗi từ. */
export function cleanFullName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('vi')
    .split(' ')
    .map((w) => w.charAt(0).toLocaleUpperCase('vi') + w.slice(1))
    .join(' ');
}

/** Tên để so trùng: bỏ dấu, chữ thường. */
export function normalizeName(name: string): string {
  return cleanFullName(name)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();
}

/** Năm sinh có nằm ngoài giới hạn không (hạng riêng ưu tiên, không có thì theo giải). */
export function isOutsideBirthYears(
  birthYear: number,
  category: { birthYearMin: number | null; birthYearMax: number | null },
  tournament: { birthYearMin: number | null; birthYearMax: number | null },
): boolean {
  const min = category.birthYearMin ?? tournament.birthYearMin;
  const max = category.birthYearMax ?? tournament.birthYearMax;
  return (min !== null && birthYear < min) || (max !== null && birthYear > max);
}

/** Giới tính VĐV có hợp với hạng không (hạng 'open' nhận mọi người). */
export const genderFits = (athlete: 'male' | 'female', category: 'male' | 'female' | 'open') =>
  category === 'open' || category === athlete;

/**
 * Chia số tiền phải trả thêm cho các hạng mới (để lưu snapshot `fee` từng hạng):
 * mỗi hạng giá lẻ, hạng cuối nhận phần chênh (giảm combo); không hạng nào âm.
 */
export function allocateFees(count: number, total: number, singlePrice: number): number[] {
  if (count === 0) return [];
  const out: number[] = [];
  let left = total;
  for (let i = 0; i < count; i++) {
    const fee = i === count - 1 ? left : Math.min(singlePrice, left);
    out.push(Math.max(0, fee));
    left -= fee;
  }
  return out;
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // bỏ I, O, 0, 1 dễ nhầm
/** Mã nội dung chuyển khoản, duy nhất toàn hệ thống: "VT" + 6 ký tự. */
export function newTransferRef(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  return `VT${[...random(6)].map((b) => ALPHABET[b % ALPHABET.length]).join('')}`;
}

/** Token link vé riêng (khó đoán). */
export function newTicketToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(18));
  return Buffer.from(b).toString('base64url');
}

/** Tìm mã tham chiếu trong nội dung chuyển khoản (ngân hàng có thể chèn thêm chữ, bỏ khoảng trắng). */
export function findTransferRef(content: string): string | null {
  const m = /VT[A-HJ-NP-Z2-9]{6}/.exec(content.toUpperCase().replace(/[^A-Z0-9]/g, ''));
  return m ? m[0] : null;
}
