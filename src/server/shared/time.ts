/**
 * Giờ Việt Nam (UTC+7, không đổi giờ mùa hè). Form nhận chuỗi "YYYY-MM-DDTHH:mm" theo giờ VN.
 */
export const VN_TZ = 'Asia/Ho_Chi_Minh';

/** "2026-12-15T07:00" (giờ VN) → Date. Trả null nếu rỗng hoặc sai định dạng. */
export function parseVnLocal(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+07:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date → "YYYY-MM-DDTHH:mm" theo giờ VN (cho value của input datetime-local). */
export function toVnLocal(date: Date | null | undefined): string {
  if (!date) return '';
  const vn = new Date(date.getTime() + 7 * 3600_000);
  return vn.toISOString().slice(0, 16);
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('vi-VN', { timeZone: VN_TZ, ...opts });

/** "07:00 · 15.12.2026" */
export function formatDateTime(date: Date): string {
  const p = Object.fromEntries(
    fmt({ hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric', hour12: false })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  return `${p.hour}:${p.minute} · ${p.day}.${p.month}.${p.year}`;
}

/** "Chủ nhật 15.12.2026" */
export function formatDayDate(date: Date): string {
  const p = Object.fromEntries(
    fmt({ weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(date).map((x) => [x.type, x.value]),
  );
  const wd = String(p.weekday);
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)} ${p.day}.${p.month}.${p.year}`;
}

/** "07:00" */
export function formatTime(date: Date): string {
  return fmt({ hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}

/** 150000 → "150.000đ" */
export function formatVnd(amount: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(amount)}đ`;
}
