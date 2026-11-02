# Kế hoạch coding MVP

1 người + Claude Code, sprint 1 tuần. Mục tiêu: **chạy thật một giải nhỏ sau Sprint 5**, rồi hoàn thiện theo phản hồi.
Thứ tự theo hành trình thật của một giải: tạo giải → mở đăng ký → thu tiền → ngày thi đấu → kết quả.

## Có dùng template không?

Không dùng boilerplate SaaS (chúng kèm Stripe, i18n, multi-tenant… không cần, và khó gỡ khi chuyển NestJS).
Dùng **thành phần có sẵn** thay vì tự viết:

| Việc | Dùng |
|---|---|
| Khung dự án | `create-next-app` (đã tạo) |
| UI cơ bản (dialog, dropdown, toast, form) | **shadcn/ui** — copy code vào repo, chỉnh theo theme A |
| Form + validate | react-hook-form + zod |
| Cắt ảnh bìa | react-easy-crop |
| Kéo thả bảng đấu | dnd-kit |
| Mã QR | `qrcode`; ảnh VietQR qua chuẩn NAPAS (img.vietqr.io) |
| Quét QR vé | `@zxing/browser` hoặc `html5-qrcode` |
| OG image / ảnh chia sẻ | `next/og` (Satori) |
| PDF bằng khen | `@react-pdf/renderer` + font Barlow |
| Excel | `exceljs` |
| Email | Resend |

**Tự viết** (lõi riêng của sản phẩm, có unit test): sinh bảng loại đơn/kép, tiến trận, tính phí combo, xét cân, Toàn năng, đối soát giao dịch.
Có thể tham khảo thuật toán của thư viện `brackets-manager` nhưng không dùng trực tiếp vì nó có mô hình lưu trữ riêng, khác schema của mình.

## Sprint 0 — Nền móng (2–3 ngày)
- [x] Next.js + TS + Tailwind, Drizzle schema, `CLAUDE.md`, tài liệu DB
- [x] Tạo project Supabase
- [x] Migration đầu tiên `drizzle/0000_init.sql` (chạy qua workflow DB migrate)
- [x] `src/lib/auth.ts`, `realtime.ts`, `storage.ts` (lớp bọc Supabase) + middleware làm mới phiên
- [x] Theme A: màu, font Barlow/Barlow Condensed (có tiếng Việt), nút xéo
- [x] Module mẫu `src/server/registration/fees.ts` + 15 unit test
- [x] GitHub Actions: CI (typecheck, lint, test, build), DB migrate, backup hằng đêm
- [ ] Bạn: cấu hình Supabase / GitHub secret / Vercel (mục "Thiết lập một lần" bên dưới)
- [ ] Cài shadcn/ui khi bắt đầu Sprint 1

## Sprint 1 — BTC tạo giải & trang công khai (chức năng 1–13, 30–34)
- Đăng nhập BTC (Google / email), tạo organization, thông tin nhận tiền
- Wizard 5 bước: thông tin + ảnh bìa (cắt 1.91:1) → hạng mục (mẫu gợi ý, Toàn năng) → lệ phí & đợt giá → lịch phiên & giải thưởng → xuất bản
- Trang giải công khai `/[slug]` (SSR), OG image, nút chia sẻ, bài đăng mẫu, QR giải
- **Xong khi:** tạo một giải trong ~5 phút, dán link vào Messenger thấy ảnh xem trước đẹp

## Sprint 2 — Đăng ký & thanh toán (36–38, 15)
- Form đăng ký không tài khoản, nhiều hạng, cảnh báo năm sinh, ô đồng ý NĐ 13
- Tính phí (combo, đợt giá, đăng ký thêm), chống vượt số suất, sinh mã + `transfer_ref`
- Trang thanh toán VietQR, trang vé QR (link riêng)
- Webhook SePay/Casso → `payments`, hàng chờ giao dịch chưa khớp, xác nhận tay
- **Xong khi:** chuyển khoản thật 2.000đ vào TK test → trang tự chuyển "Đã đóng"

## Sprint 3 — Quản lý đăng ký & check-in (14, 16, 17, 21, 22, 24)
- Dashboard giải, danh sách (duyệt/sửa/xóa/lọc), xuất Excel
- Đăng ký tại chỗ + ghi tiền mặt
- Check-in: quét vé, nhập cân, gợi ý đạt/không đạt có dung sai, chuyển hạng
- Dời lịch + thông báo (email, banner, văn bản copy Zalo), báo cáo thu chi
- **Xong khi:** chạy thử check-in 20 VĐV giả lập trên điện thoại

## Sprint 4 — Bảng đấu, bàn đấu, trọng tài (18, 19, 45–47, 51, 39)
- Sinh bảng loại đơn (+ tranh hạng 3) và loại kép (+ đấu lại CK), bốc thăm, kéo thả chỉnh
- Quản lý bàn, hàng chờ trận, gán trận vào bàn
- Tablet trọng tài (PWA): chọn thắng, hoàn tác, ghi lỗi/cảnh cáo; idempotent + version
- Realtime cho BTC/tablet; khán giả cập nhật mỗi 3–5s; "trận tiếp theo của tôi"
- **Xong khi:** mô phỏng hạng 16 VĐV loại kép trên 2 tablet, kết quả hiện đúng ở màn khán giả

## Sprint 5 — Kết quả & hoàn thiện (8, 20, 23, 35, 55, 56)
- Xếp hạng cuối, Toàn năng tự động, bằng khen PDF, ảnh chia sẻ kết quả
- Admin: quản lý người dùng/BTC/giải, nhật ký thay đổi kết quả
- Kiểm thử trong trình duyệt nhúng Zalo/Facebook, tối ưu tốc độ trang giải
- **Xong khi:** chạy trọn một giải thử nghiệm từ đầu đến cuối

## Sprint 6 — Giải thật đầu tiên (pilot)
- Tìm 1 BTC thân quen (ví dụ giải CLB/trường), đồng hành tại sân, ghi lại lỗi và góp ý
- Sửa lỗi, rồi mới mở cho BTC khác

## Thiết lập một lần (Sprint 0)

**Supabase** (project `ezqzrorbzkatygdpxyoc`):
1. Storage → tạo bucket `public-images`, bật Public.
2. Authentication → Providers: bật Email (magic link); Google khi có OAuth client.
3. Authentication → URL Configuration: thêm `http://localhost:3000/**` và domain Vercel vào Redirect URLs.

**GitHub** → Settings → Secrets and variables → Actions:
- `DATABASE_URL_DIRECT`: chuỗi kết nối Postgres cổng 5432 (Supabase → Connect). Dùng cho migrate và backup.

**Vercel** → Import repo → Environment Variables (giá trị từ Supabase → Project Settings → API / Connect):
- `DATABASE_URL` (Transaction pooler, cổng 6543)
- `NEXT_PUBLIC_SUPABASE_URL` = `https://ezqzrorbzkatygdpxyoc.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `APP_ENCRYPTION_KEY` (`openssl rand -base64 32`)
- `NEXT_PUBLIC_SITE_URL` = domain Vercel

Không dán các khóa bí mật vào chat hay commit vào repo.
