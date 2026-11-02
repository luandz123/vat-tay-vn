/** Tạo đường dẫn ngắn cho giải: "Giải vật tay PTIT mở rộng 2026" → "giai-vat-tay-ptit-mo-rong-2026". */

/** Đường dẫn đã dùng cho trang của hệ thống, không cho giải đặt trùng. */
export const RESERVED_SLUGS = new Set([
  'btc', 'admin', 'api', 'auth', 'dang-nhap', 'dang-ky', 've', 'trong-tai', 'gioi-thieu', 'lien-he',
  'dieu-khoan', 'chinh-sach', 'giai', 'static', 'public', 'favicon.ico', 'robots.txt', 'sitemap.xml',
]);

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$/;

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && !RESERVED_SLUGS.has(slug);
}

/** Chọn slug chưa bị dùng: base, base-2, base-3… */
export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  const root = isValidSlug(base) ? base : `giai-${base || 'moi'}`.slice(0, 56).replace(/-+$/g, '');
  if (!taken.has(root) && isValidSlug(root)) return root;
  for (let i = 2; ; i++) {
    const candidate = `${root.slice(0, 56)}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Tiền tố mã đăng ký: "Giải vật tay PTIT 2026" → "PT26" (chữ cái tên riêng + 2 số cuối năm). */
export function codePrefixFrom(name: string, year: number): string {
  const ignore = new Set(['giai', 'vat', 'tay', 'mo', 'rong', 'lan', 'thu', 'cup', 'nam', 'tranh']);
  const words = slugify(name).split('-').filter((w) => w && !/^\d+$/.test(w) && !ignore.has(w));
  const letters = (words[0] ?? 'vt').replace(/[^a-z]/g, '').slice(0, 2).toUpperCase().padEnd(2, 'T');
  return `${letters}${String(year % 100).padStart(2, '0')}`;
}
