/**
 * Kiểm thử end-to-end toàn bộ luồng một giải (chạy ở máy, KHÔNG chạy trên production).
 *
 * Cần: app chạy với E2E_ALLOW_FAKE_AUTH=1 (đăng nhập giả qua cookie `e2e_user`) và Postgres riêng cho test.
 *   BASE_URL=http://localhost:3123 DATABASE_URL=postgres://... node e2e/smoke.mjs
 * Xem e2e/README.md. Script XÓA SẠCH schema public của DATABASE_URL — đừng trỏ vào DB thật.
 */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import postgres from 'postgres';

const BASE = process.env.BASE_URL ?? 'http://localhost:3123';
const DB_URL = process.env.DATABASE_URL;
if (!DB_URL || /supabase|pooler/.test(DB_URL)) throw new Error('DATABASE_URL phải trỏ vào Postgres test riêng');

const sql = postgres(DB_URL, { max: 1, onnotice: () => {} });
const step = (name) => console.log(`\n▶ ${name}`);
const ok = (msg) => console.log(`  ✓ ${msg}`);

/* ───────── Chuẩn bị DB sạch ───────── */
step('Chuẩn bị DB');
await sql.unsafe(`DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;
  DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
execSync('npx drizzle-kit migrate', { env: { ...process.env, DATABASE_URL: DB_URL }, stdio: 'pipe' });
const [btc] = await sql`insert into users (auth_subject, email) values ('e2e-btc', 'btc@e2e.test') returning id`;
ok('migrate + tạo tài khoản BTC');

/* ───────── Trình duyệt ───────── */
const browser = await chromium.launch();
const errors = [];
async function newPage(userId) {
  const ctx = await browser.newContext({ locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
  if (userId) await ctx.addCookies([{ name: 'e2e_user', value: userId, url: BASE }]);
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  page.on('dialog', (d) => d.accept());
  page.on('response', (r) => {
    if (r.status() >= 500) errors.push(`${r.status()} ${r.request().method()} ${r.url()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror ${page.url()}: ${e.message}`));
  return page;
}
const page = await newPage(btc.id);

try {
  /* 1. Tạo BTC */
  step('Tạo Ban tổ chức');
  await page.goto(`${BASE}/btc`);
  await page.waitForURL('**/btc/to-chuc/moi');
  await page.getByLabel('Tên BTC / CLB *').fill('CLB Vật tay E2E');
  await page.getByLabel('Số điện thoại').fill('0912345678');
  await page.getByLabel('Ngân hàng').selectOption({ label: 'Vietcombank' });
  await page.getByLabel('Số tài khoản').fill('0123456789');
  await page.getByLabel('Tên chủ tài khoản').fill('clb vat tay');
  await page.getByRole('button', { name: 'Tạo BTC' }).click();
  await page.waitForURL(`${BASE}/btc`);
  ok('đã tạo BTC');

  /* 2. Wizard */
  step('Wizard tạo giải');
  await page.getByLabel('Tên giải').fill('Giải vật tay E2E 2026');
  await page.getByRole('button', { name: 'Bắt đầu →' }).click();
  await page.waitForURL('**/thong-tin');
  await page.getByLabel('Bắt đầu *').fill('2026-12-15T07:00');
  await page.getByLabel('Địa điểm *').fill('Nhà thi đấu E2E');
  await page.getByLabel('Hạn đăng ký online').fill('2026-12-12T23:59');
  await page.getByLabel('Năm sinh từ').fill('1990');
  await page.getByLabel('Năm sinh đến').fill('2008');
  await page.getByLabel('Dung sai cân (kg)').fill('1');
  await page.getByLabel('Lưu ý cho VĐV (móng tay, trang sức, giấy tờ…)').fill('Cắt móng tay\nKhông đeo nhẫn');
  await page.getByRole('button', { name: 'Tiếp: Hạng mục →' }).click();
  await page.waitForURL('**/hang-muc');
  ok('bước 1');

  await page.getByRole('button', { name: '+ Nam phổ thông 57/63/73/+73' }).click();
  await page.getByRole('button', { name: 'Lưu nháp' }).click();
  await page.getByText(/Đã lưu lúc/).waitFor();
  await page.getByRole('button', { name: 'Lưu nháp' }).click(); // lưu lần 2 không được nhân đôi hạng
  await page.getByText(/Đã lưu lúc/).waitFor();
  await page.getByRole('button', { name: 'Tiếp: Lệ phí →' }).click();
  await page.waitForURL('**/le-phi');
  const [{ n: catCount }] = await sql`select count(*)::int n from categories`;
  assert.equal(catCount, 8, 'lưu 2 lần vẫn 8 hạng');
  ok('bước 2: 8 hạng, lưu lại không bị trùng');

  const singles = page.getByLabel('Giá 1 tay');
  const combos = page.getByLabel('Giá combo 2 tay');
  await singles.nth(0).fill('150000');
  await combos.nth(0).fill('250000');
  await singles.nth(1).fill('200000');
  await combos.nth(1).fill('320000');
  await page.getByRole('button', { name: 'Tiếp: Lịch & giải thưởng →' }).click();
  await page.waitForURL('**/lich-giai-thuong');
  ok('bước 3');

  await page.getByRole('button', { name: 'Sáng tay trái · chiều tay phải' }).click();
  await page.getByRole('button', { name: 'Tiếp: Xuất bản →' }).click();
  await page.waitForURL('**/xuat-ban');
  await page.getByText('Chưa có ảnh bìa / poster').waitFor();
  const [{ n: unassigned }] = await sql`select count(*)::int n from categories where session_id is null`;
  assert.equal(unassigned, 0, 'mọi hạng đã gán phiên');
  ok('bước 4 + checklist báo thiếu ảnh bìa');

  // Ảnh bìa đi qua Supabase Storage thật → giả lập key trong DB
  const [t] = await sql`update tournaments set cover_image_key = 'tournaments/' || id || '/cover-1.jpg', og_image_key = 'tournaments/' || id || '/og-1.jpg' returning id, slug`;
  await page.reload();
  await page.getByRole('button', { name: /Xuất bản & mở đăng ký|Vẫn xuất bản/ }).click();
  await page.getByText('Chia sẻ giải').waitFor();
  ok(`xuất bản: /${t.slug}`);

  /* 3. Trang công khai + đăng ký */
  step('VĐV đăng ký');
  const pub = await newPage(null);
  await pub.goto(`${BASE}/${t.slug}`);
  await pub.getByRole('heading', { level: 1, name: 'Giải vật tay E2E 2026' }).waitFor();
  const people = [
    ['Nguyễn Minh Khang', '0981000001', true],
    ['Trần Đức Anh', '0981000002', false],
    ['Lê Hoàng Nam', '0981000003', false],
    ['Phạm Quốc Tùng', '0981000004', false],
  ];
  const tickets = [];
  for (const [name, phone, both] of people) {
    await pub.goto(`${BASE}/${t.slug}/dang-ky`);
    await pub.getByLabel('Họ và tên').fill(name);
    await pub.getByLabel('Số điện thoại (Zalo)').fill(phone);
    await pub.getByLabel('Năm sinh', { exact: true }).fill('2000');
    const right = pub.locator('fieldset').filter({ hasText: 'Tay phải' });
    await right.getByRole('button', { name: '-63kg' }).click();
    if (both) await pub.locator('fieldset').filter({ hasText: 'Tay trái' }).getByRole('button', { name: '-63kg' }).click();
    await pub.getByRole('checkbox').check();
    await pub.getByRole('button', { name: /Tiếp tục thanh toán/ }).click();
    await pub.waitForURL('**/ve/**');
    await pub.getByRole('heading', { name: 'Thanh toán lệ phí' }).waitFor();
    tickets.push(pub.url());
  }
  await pub.goto(tickets[0]);
  await pub.getByText('250.000đ').first().waitFor();
  ok('4 VĐV đăng ký, VĐV 1 combo 2 tay = 250.000đ, có QR thanh toán');

  /* 4. BTC thu tiền */
  step('BTC quản lý đăng ký');
  await page.goto(`${BASE}/btc/giai/${t.id}/dang-ky`);
  await page.getByRole('cell', { name: /Nguyễn Minh Khang/ }).waitFor();
  const row = page.getByRole('row').filter({ hasText: 'Nguyễn Minh Khang' });
  await row.getByRole('button', { name: 'Thu tiền' }).click();
  await page.getByRole('button', { name: 'Xác nhận đã thu' }).click();
  await row.getByText('Đã đóng').waitFor();
  ok('thu tiền mặt → Đã đóng');
  const xlsx = await page.request.get(`${BASE}/btc/giai/${t.id}/xuat-excel`);
  assert.equal(xlsx.status(), 200);
  assert.match(xlsx.headers()['content-type'], /spreadsheet/);
  ok('xuất Excel');
  await pub.goto(tickets[0]);
  await pub.getByText(/BTC đã nhận 250.000đ/).waitFor();
  ok('vé hiện Đã đóng');

  /* 5. Check-in */
  step('Check-in & cân');
  await page.goto(`${BASE}/btc/giai/${t.id}/check-in`);
  for (const [name] of people) {
    await page.getByRole('button', { name: new RegExp(name) }).first().click();
    await page.getByLabel('Cân nặng thực tế (kg)').fill('62.5');
    await page.getByText('Đạt', { exact: true }).first().waitFor();
    await page.getByRole('button', { name: 'Xác nhận cân & check-in' }).click();
    await page.getByText(`Đã check-in ${name}`).waitFor();
  }
  ok('4 VĐV đã cân đạt');

  /* 6. Bảng đấu */
  step('Bảng đấu, bàn, trọng tài');
  const [r63] = await sql`select id from categories where hand = 'right' and label = '-63kg'`;
  await page.goto(`${BASE}/btc/giai/${t.id}/bang-dau?hang=${r63.id}`);
  await page.getByRole('button', { name: 'Bốc thăm & tạo bảng' }).click();
  await page.getByText('Bán kết').waitFor();
  await page.getByRole('button', { name: '+ Thêm bàn' }).click();
  await page.locator('span.display', { hasText: 'Bàn 1' }).waitFor();
  await page.getByRole('button', { name: 'Tạo link tablet' }).click();
  const link = await page.locator('code').filter({ hasText: '/trong-tai/' }).innerText();
  ok('bốc thăm, thêm bàn, tạo link tablet');

  const assignFirst = async () => {
    const sel = page.getByLabel('Gán bàn').first();
    await sel.selectOption({ label: 'Bàn 1' });
    await page.waitForLoadState('networkidle');
  };
  await assignFirst();
  const ref = await newPage(null);
  await ref.goto(link.replace(/^https?:\/\/[^/]+/, BASE));
  await ref.getByRole('button', { name: /^Thắng/ }).first().click();
  await ref.getByText('Đã ghi kết quả').waitFor();
  await ref.getByRole('button', { name: '↶ Hoàn tác' }).click();
  await ref.getByRole('button', { name: /^Thắng/ }).first().waitFor();
  ok('trọng tài ghi kết quả rồi hoàn tác');
  await ref.getByRole('button', { name: '+ Lỗi' }).first().click();
  await ref.getByText('(1)').first().waitFor();
  await ref.getByRole('button', { name: /^Thắng/ }).first().click();
  await ref.getByText('Đã ghi kết quả').waitFor();
  await ref.getByRole('button', { name: 'Trận tiếp theo →' }).click();
  ok('ghi lỗi, ghi lại kết quả');

  // BTC nhập nốt các trận còn lại (Đỏ thắng)
  for (let i = 0; i < 5; i++) {
    await page.reload();
    const btn = page.getByRole('button', { name: 'Đỏ thắng' });
    if ((await btn.count()) === 0) break;
    await btn.first().click();
    await page.waitForLoadState('networkidle');
  }
  const [{ n: places }] = await sql`select count(*)::int n from category_results where category_id = ${r63.id}`;
  assert.ok(places >= 3, `có xếp hạng (${places})`);
  ok(`hạng -63kg tay phải xong, ${places} thứ hạng`);

  /* 7. Kết quả, bằng khen, trực tiếp */
  step('Kết quả & chia sẻ');
  await page.goto(`${BASE}/btc/giai/${t.id}/ket-qua`);
  await page.getByText('Nhất', { exact: true }).first().waitFor();
  const pdf = await page.request.get(`${BASE}/btc/giai/${t.id}/bang-khen?hang=${r63.id}`);
  assert.equal(pdf.status(), 200);
  assert.equal(pdf.headers()['content-type'], 'application/pdf');
  ok('bằng khen PDF');
  const live = await pub.request.get(`${BASE}/api/giai/${t.slug}/truc-tiep`);
  assert.equal(live.status(), 200);
  await pub.goto(`${BASE}/${t.slug}/truc-tiep`);
  await pub.getByRole('heading', { name: 'Kết quả' }).waitFor();
  ok('trang trực tiếp có kết quả');
  const img = await pub.request.get(`${BASE}/api/giai/${t.slug}/anh-ket-qua/${r63.id}`);
  assert.equal(img.status(), 200);
  assert.match(img.headers()['content-type'], /image\/png/);
  ok('ảnh chia sẻ kết quả');
  await pub.goto(tickets[0]);
  await pub.getByRole('heading', { name: 'Trận tiếp theo của tôi' }).waitFor();
  ok('vé có "Trận tiếp theo của tôi"');

  /* 8. Các trang còn lại không lỗi */
  step('Các trang quản lý khác');
  for (const p of ['', '/thong-bao', '/thu-chi']) {
    await page.goto(`${BASE}/btc/giai/${t.id}${p}`);
    await page.waitForLoadState('networkidle');
  }
  await page.goto(`${BASE}/btc/giai/${t.id}/thong-bao`);
  await page.getByLabel('Tiêu đề').fill('Lịch cân sáng chủ nhật');
  await page.getByLabel('Nội dung').fill('Cân từ 7h tại sảnh A');
  await page.getByRole('button', { name: 'Gửi thông báo' }).click();
  await page.getByText(/dán vào nhóm Zalo/).waitFor();
  await pub.goto(`${BASE}/${t.slug}`);
  await pub.getByText('📢 Lịch cân sáng chủ nhật').waitFor();
  ok('thông báo hiện banner trên trang giải');
} catch (e) {
  console.error('\n✗ LỖI:', e.message);
  errors.push(`test: ${e.message}`);
} finally {
  await browser.close();
  await sql.end();
}

if (errors.length) {
  console.error('\nCó lỗi:\n' + errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}
console.log('\nTẤT CẢ ĐỀU QUA ✔');
