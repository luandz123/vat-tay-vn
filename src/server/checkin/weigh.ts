/**
 * Xét cân: chỉ GỢI Ý đạt/không đạt (đã tính dung sai) và hạng phù hợp. BTC quyết định cuối.
 */
export interface WeightClass {
  id: string;
  hand: 'left' | 'right';
  gender: 'male' | 'female' | 'open';
  label: string;
  weightMinKg: number | null;
  weightMaxKg: number | null;
  sortOrder: number;
}

export interface WeighVerdict {
  pass: boolean;
  /** Giới hạn trên đã cộng dung sai (null = không giới hạn). */
  limitKg: number | null;
  /** Dư (dương) hoặc vượt (âm) so với giới hạn, kg. */
  marginKg: number | null;
  /** Hạng gợi ý khi không đạt: hạng cùng tay & giới tính nhỏ nhất mà VĐV đạt. */
  suggestion: WeightClass | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function fitsClass(kg: number, c: Pick<WeightClass, 'weightMinKg' | 'weightMaxKg'>, toleranceKg: number): boolean {
  // Cận dưới không cộng dung sai: hạng "+73" nhận người nặng hơn 73kg; nhẹ hơn vẫn được "đánh lên" nên không chặn.
  return c.weightMaxKg === null || kg <= c.weightMaxKg + toleranceKg + 1e-9;
}

export function evaluateWeigh(kg: number, current: WeightClass, all: readonly WeightClass[], toleranceKg: number): WeighVerdict {
  const pass = fitsClass(kg, current, toleranceKg);
  const limitKg = current.weightMaxKg === null ? null : round2(current.weightMaxKg + toleranceKg);
  const marginKg = limitKg === null ? null : round2(limitKg - kg);
  let suggestion: WeightClass | null = null;
  if (!pass) {
    suggestion =
      [...all]
        .filter((c) => c.hand === current.hand && c.gender === current.gender && c.id !== current.id && fitsClass(kg, c, toleranceKg))
        .sort((a, b) => (a.weightMaxKg ?? Infinity) - (b.weightMaxKg ?? Infinity) || a.sortOrder - b.sortOrder)[0] ?? null;
  }
  return { pass, limitKg, marginKg, suggestion };
}

/** Chuẩn hóa số cân người dùng gõ: "64,6" → 64.6; trả null nếu không hợp lệ. */
export function parseKg(input: string): number | null {
  const n = Number(input.trim().replace(',', '.'));
  return Number.isFinite(n) && n > 20 && n < 300 ? round2(n) : null;
}
