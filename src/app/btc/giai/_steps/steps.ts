/** Các bước wizard tạo giải. File thường (không 'use client') để cả trang server lẫn component client dùng được. */
export const STEPS = [
  { slug: 'thong-tin', title: 'Thông tin & ảnh bìa' },
  { slug: 'hang-muc', title: 'Hạng mục' },
  { slug: 'le-phi', title: 'Lệ phí & đợt giá' },
  { slug: 'lich-giai-thuong', title: 'Lịch phiên & giải thưởng' },
  { slug: 'xuat-ban', title: 'Xuất bản & chia sẻ' },
] as const;
export type StepSlug = (typeof STEPS)[number]['slug'];
