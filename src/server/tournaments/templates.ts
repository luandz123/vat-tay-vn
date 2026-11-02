/** Mẫu hạng cân gợi ý. BTC thêm bằng một chạm rồi sửa tự do (không ép theo WAF). */
export type Hand = 'left' | 'right';
export type CategoryGender = 'male' | 'female' | 'open';

export interface CategoryDraft {
  key: string; // id có sẵn hoặc khóa tạm phía client
  kind: 'weight' | 'all_around';
  hand: Hand;
  gender: CategoryGender;
  label: string;
  weightMinKg: number | null;
  weightMaxKg: number | null;
  birthYearMin: number | null;
  birthYearMax: number | null;
  capacity: number | null;
  sessionKey: string | null;
  allAroundMaxPlace: number | null;
  allAroundSourceKeys: string[];
}

export interface CategoryTemplate {
  id: string;
  name: string;
  gender: CategoryGender;
  /** Giới hạn trên từng hạng; null = hạng cuối (ngoại hạng, trên mức trước đó). */
  limits: (number | null)[];
}

export const CATEGORY_TEMPLATES: CategoryTemplate[] = [
  { id: 'nam-pho-thong', name: 'Nam phổ thông 57/63/73/+73', gender: 'male', limits: [57, 63, 73, null] },
  { id: 'nu', name: 'Nữ 55/+55', gender: 'female', limits: [55, null] },
  { id: 'nam-sinh-vien', name: 'Nam sinh viên 60/70/80/+80', gender: 'male', limits: [60, 70, 80, null] },
  { id: 'nam-chuyen', name: 'Nam 60/70/80/90/+90', gender: 'male', limits: [60, 70, 80, 90, null] },
];

export function weightLabel(min: number | null, max: number | null): string {
  if (max !== null) return `-${trimKg(max)}kg`;
  if (min !== null) return `+${trimKg(min)}kg`;
  return 'Tự do';
}

const trimKg = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Sinh hạng từ mẫu cho các tay đã chọn. `newKey` sinh khóa tạm. */
export function categoriesFromTemplate(
  tpl: CategoryTemplate,
  hands: readonly Hand[],
  newKey: () => string,
): CategoryDraft[] {
  const out: CategoryDraft[] = [];
  for (const hand of hands) {
    tpl.limits.forEach((max, i) => {
      const min = max === null ? (tpl.limits[i - 1] ?? null) : null;
      out.push({
        key: newKey(),
        kind: 'weight',
        hand,
        gender: tpl.gender,
        label: weightLabel(min, max),
        weightMinKg: min,
        weightMaxKg: max,
        birthYearMin: null,
        birthYearMax: null,
        capacity: null,
        sessionKey: null,
        allAroundMaxPlace: null,
        allAroundSourceKeys: [],
      });
    });
  }
  return out;
}

export const HAND_LABEL: Record<Hand, string> = { left: 'Tay trái', right: 'Tay phải' };
export const GENDER_LABEL: Record<CategoryGender, string> = { male: 'Nam', female: 'Nữ', open: 'Mở' };
