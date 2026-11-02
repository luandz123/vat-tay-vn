# VậtTay.vn

Nền tảng quản lý giải vật tay phong trào/bán chuyên: BTC tạo giải, nhận đăng ký, thu phí VietQR, cân, xếp bảng, cập nhật kết quả realtime. Một người phát triển cùng Claude Code. Ngôn ngữ giao diện: tiếng Việt.

## Tài liệu
- `docs/database.md` — thiết kế DB và các quyết định nghiệp vụ (đọc trước khi sửa schema).
- `docs/plan.md` — kế hoạch sprint MVP.
- Thiết kế UI (canvas): https://claude.ai/artifact/3wdJAN2fPDpezwtWi6q3Mb — phong cách A "Đấu trường đêm".

## Stack
Next.js 15 (App Router, TypeScript, Tailwind 4) · Drizzle ORM + PostgreSQL · Supabase (Auth, Realtime, Storage) · Vercel · Vitest.

## Quy tắc kiến trúc (BẮT BUỘC — để sau này chuyển sang NestJS)
1. Logic nghiệp vụ nằm trong `src/server/<module>/` dưới dạng hàm TypeScript thuần (nhận input đã validate bằng zod, trả kết quả). Route handler / server action chỉ là lớp mỏng gọi vào đó. Không viết logic trong component, SQL function, trigger hay RLS.
2. Chỉ `src/lib/auth.ts`, `src/lib/realtime.ts`, `src/lib/storage.ts` được import `@supabase/*`. Nơi khác gọi qua các module này.
3. Truy cập DB chỉ qua Drizzle (`src/db`). Đổi schema = sửa `src/db/schema.ts` rồi `npm run db:generate`; không sửa schema trên dashboard Supabase.
4. Kiểm tra quyền ở server code (RLS chỉ là lớp phụ). BTC chỉ thấy giải của organization mình; trọng tài chỉ thao tác bàn của mình.
5. Ảnh lưu key, không lưu URL đầy đủ.

## Quy tắc nghiệp vụ
- Hệ thống **cảnh báo, không chặn** (sai năm sinh, không đạt cân) — BTC quyết định.
- Tiền: số nguyên VND (`bigint`), không dùng float. Cân: `numeric(5,2)`. Giờ: `timestamptz`, hiển thị `Asia/Ho_Chi_Minh`.
- Nền tảng không giữ tiền: VietQR về thẳng tài khoản BTC; đối soát qua webhook SePay/Casso, khớp theo `registrations.transfer_ref`.
- Ghi kết quả idempotent (`match_events.client_event_id`) + optimistic lock (`matches.version`); hoàn tác là event mới, không xóa.
- Mọi thay đổi kết quả / chuyển hạng / tiền → ghi `audit_logs`.
- SĐT luôn che trên trang công khai.
- MVP chưa có Zalo ZNS/SMS: thông báo = email + banner trên trang + văn bản để BTC copy vào nhóm Zalo.

## Lệnh
- `npm run dev` · `npm run typecheck` · `npm run lint` · `npm test`
- `npm run db:generate` (tạo migration) · `npm run db:migrate`

## Quy ước code
- Logic khó (bốc thăm, sinh bảng loại đơn/kép, tiến trận, tính phí combo, xét cân, Toàn năng) phải có unit test Vitest trong `src/server/**/*.test.ts`.
- Service có DB: integration test `*.int.test.ts` chạy Postgres thật trong bộ nhớ (PGlite, `src/test/pglite-db.ts`, dữ liệu mẫu `src/test/fixtures.ts`) với `vi.mock('@/db', () => import('@/test/pglite-db'))`.
- Trong `db.transaction(async (tx) => …)` CHỈ dùng `tx`, không gọi hàm dùng `db` toàn cục (kiểm tra quyền làm trước transaction). Vi phạm sẽ treo test PGlite.
- Bảng đấu: trạng thái luôn tính lại bằng `src/server/brackets/engine.ts` từ khung + kết quả (`recompute`), không sửa tay `matches.status`.
- Migration chạy lên Supabase: `drizzle-kit migrate` (CI, cần secret) hoặc qua Management API rồi ghi `drizzle.__drizzle_migrations`.
- Trước khi báo xong: `npm run typecheck && npm run lint && npm test`.
- Không deploy vào ngày có giải đang diễn ra.
