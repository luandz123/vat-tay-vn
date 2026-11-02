/**
 * Kiểm tra trước khi xuất bản. "error" = thiếu thông tin bắt buộc (chưa xuất bản được);
 * "warning" = điểm bất thường, BTC vẫn xuất bản được (nguyên tắc: cảnh báo, không chặn).
 */
export type Step = 'thong-tin' | 'hang-muc' | 'le-phi' | 'lich-giai-thuong';

export interface ChecklistIssue {
  level: 'error' | 'warning';
  step: Step;
  message: string;
}

export interface ChecklistInput {
  name: string;
  coverImageKey: string | null;
  startsAt: Date | null;
  venueName: string | null;
  registrationDeadline: Date | null;
  birthYearMin: number | null;
  birthYearMax: number | null;
  hasContact: boolean;
  hasBankInfo: boolean;
  categories: {
    label: string;
    kind: 'weight' | 'all_around';
    hand: 'left' | 'right';
    gender: string;
    sessionId: string | null;
    weightMinKg: number | null;
    weightMaxKg: number | null;
    sourceCount: number;
  }[];
  priceTiers: { kind: 'online' | 'onsite'; singleHandPrice: number; bothHandsPrice: number | null; validUntil: Date | null }[];
  sessionsCount: number;
  now: Date;
}

export function publishChecklist(t: ChecklistInput): ChecklistIssue[] {
  const issues: ChecklistIssue[] = [];
  const err = (step: Step, message: string) => issues.push({ level: 'error', step, message });
  const warn = (step: Step, message: string) => issues.push({ level: 'warning', step, message });

  if (!t.name.trim()) err('thong-tin', 'Chưa có tên giải');
  if (!t.coverImageKey) err('thong-tin', 'Chưa có ảnh bìa / poster');
  if (!t.startsAt) err('thong-tin', 'Chưa có thời gian thi đấu');
  if (!t.venueName?.trim()) err('thong-tin', 'Chưa có địa điểm');
  if (!t.hasContact) warn('thong-tin', 'Chưa có thông tin liên hệ BTC (Zalo, Facebook hoặc SĐT)');
  if (t.startsAt && t.startsAt < t.now) warn('thong-tin', 'Thời gian thi đấu đã qua');
  if (t.startsAt && t.registrationDeadline && t.registrationDeadline > t.startsAt)
    warn('thong-tin', 'Hạn đăng ký sau thời gian thi đấu');
  if (t.birthYearMin && t.birthYearMax && t.birthYearMin > t.birthYearMax)
    warn('thong-tin', 'Giới hạn năm sinh "từ" lớn hơn "đến"');

  const weights = t.categories.filter((c) => c.kind === 'weight');
  if (weights.length === 0) err('hang-muc', 'Chưa có hạng mục thi đấu nào');

  const seen = new Set<string>();
  for (const c of weights) {
    const k = `${c.hand}|${c.gender}|${c.label}`;
    if (seen.has(k)) warn('hang-muc', `Hạng ${c.label} bị trùng`);
    seen.add(k);
    if (c.weightMinKg !== null && c.weightMaxKg !== null && c.weightMinKg >= c.weightMaxKg)
      warn('hang-muc', `Hạng ${c.label}: cân tối thiểu không nhỏ hơn tối đa`);
  }
  for (const c of t.categories.filter((x) => x.kind === 'all_around')) {
    if (c.sourceCount === 0) warn('hang-muc', `Hạng ${c.label} chưa chọn hạng nguồn`);
  }

  if (t.priceTiers.length === 0) err('le-phi', 'Chưa có lệ phí (nhập 0 nếu miễn phí)');
  if (!t.priceTiers.some((p) => p.kind === 'online')) warn('le-phi', 'Chưa có giá đăng ký online');
  for (const p of t.priceTiers) {
    if (p.bothHandsPrice !== null && p.bothHandsPrice > 2 * p.singleHandPrice)
      warn('le-phi', 'Giá combo 2 tay cao hơn mua lẻ 2 tay');
    if (t.startsAt && p.validUntil && p.validUntil > t.startsAt) warn('le-phi', 'Có đợt giá hết hạn sau ngày thi đấu');
  }
  if (t.priceTiers.some((p) => p.singleHandPrice > 0) && !t.hasBankInfo)
    err('le-phi', 'Chưa có tài khoản nhận tiền (VietQR) của BTC');

  if (t.sessionsCount > 0) {
    const missing = weights.filter((c) => !c.sessionId).length;
    if (missing > 0) warn('lich-giai-thuong', `${missing} hạng mục chưa gán vào phiên thi đấu`);
  }
  return issues;
}

export const canPublish = (issues: readonly ChecklistIssue[]) => !issues.some((i) => i.level === 'error');
