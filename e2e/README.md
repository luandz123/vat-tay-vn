# Kiểm thử end-to-end

`smoke.mjs` bấm qua trọn một giải bằng trình duyệt thật (Playwright): tạo BTC → wizard 5 bước → xuất bản →
4 VĐV đăng ký → thu tiền, xuất Excel → check-in & cân → bốc thăm, bàn, tablet trọng tài (ghi/hoàn tác/lỗi) →
kết quả, bằng khen PDF, ảnh chia sẻ, trang trực tiếp, vé "trận tiếp theo" → gửi thông báo.

## Chạy ở máy

1. Một Postgres **riêng cho test** (script xóa sạch schema `public`), ví dụ:
   ```bash
   docker run -d -p 54330:5432 -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16
   ```
2. Chạy (build + start app ở chế độ test, rồi chạy kịch bản):
   ```bash
   E2E_DATABASE_URL=postgres://postgres@127.0.0.1:54330/postgres e2e/run-local.sh
   ```
   `SKIP_BUILD=1` để bỏ qua bước build khi chỉ sửa kịch bản.

## Đăng nhập giả

App đọc cookie `e2e_user=<users.id>` thay cho Supabase Auth **chỉ khi** `E2E_ALLOW_FAKE_AUTH=1` và không chạy trên
Vercel (`src/lib/auth.ts`). Không bao giờ đặt biến này trên môi trường thật.

Ngoài phạm vi kịch bản: upload ảnh bìa (Supabase Storage — giả lập key trong DB), webhook SePay (có integration test),
realtime (tắt; trang tự hỏi định kỳ), quét QR bằng camera.
