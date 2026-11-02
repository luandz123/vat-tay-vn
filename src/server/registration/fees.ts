/**
 * Tính lệ phí đăng ký. Hàm thuần, không đụng DB.
 *
 * Quy tắc (docs/database.md – Quyết định đã chốt #1):
 *  - Mỗi hạng mục tính giá 1 tay (singleHandPrice).
 *  - Nếu có cả tay trái và tay phải và đợt giá có combo: giảm (2 × single − both) một lần.
 *  - Hạng Toàn năng do hệ thống tự thêm thì không tính phí.
 *  - Đăng ký thêm: phí phần thêm = tổng theo đợt giá hiện tại − số đã tính trước đó, không âm.
 */
export type Hand = 'left' | 'right';

export interface PriceTier {
  singleHandPrice: number;
  bothHandsPrice: number | null;
}

export interface FeeEntry {
  hand: Hand;
  autoAdded?: boolean;
}

export function totalFee(entries: readonly FeeEntry[], tier: PriceTier): number {
  const paid = entries.filter((e) => !e.autoAdded);
  if (paid.length === 0) return 0;
  let total = paid.length * tier.singleHandPrice;
  const hasLeft = paid.some((e) => e.hand === 'left');
  const hasRight = paid.some((e) => e.hand === 'right');
  if (hasLeft && hasRight && tier.bothHandsPrice !== null) {
    total -= Math.max(0, 2 * tier.singleHandPrice - tier.bothHandsPrice);
  }
  return total;
}

/** Phí cho các hạng đăng ký thêm vào một bản đăng ký đã có. */
export function additionalFee(
  existing: readonly FeeEntry[],
  added: readonly FeeEntry[],
  alreadyCharged: number,
  currentTier: PriceTier,
): number {
  return Math.max(0, totalFee([...existing, ...added], currentTier) - alreadyCharged);
}

/** Trạng thái thanh toán từ số phải đóng và số đã đóng. */
export function paymentStatusOf(amountDue: number, amountPaid: number): 'unpaid' | 'partial' | 'paid' {
  if (amountPaid <= 0) return amountDue === 0 ? 'paid' : 'unpaid';
  return amountPaid >= amountDue ? 'paid' : 'partial';
}

/** Chọn đợt giá áp dụng tại thời điểm `now`. */
export function pickPriceTier<T extends { kind: 'online' | 'onsite'; validUntil: Date | null; sortOrder: number }>(
  tiers: readonly T[],
  source: 'online' | 'onsite',
  now: Date,
): T | null {
  return (
    [...tiers]
      .filter((t) => t.kind === source && (t.validUntil === null || t.validUntil >= now))
      .sort((a, b) => a.sortOrder - b.sortOrder)[0] ?? null
  );
}
