import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Chuỗi kết nối Postgres chuẩn: Supabase hôm nay, Postgres bất kỳ khi chuyển sang NestJS.
 *
 * Cấu hình cho serverless (Vercel) + pooler chế độ transaction (Supavisor, cổng 6543):
 * - prepare: false — pooler transaction không hỗ trợ prepared statement.
 * - max_pipeline: 1 — KHÔNG gửi nối đuôi nhiều truy vấn trên một kết nối. Trang có nhiều truy vấn
 *   song song (Promise.all) từng bị treo vô hạn qua Supavisor (truy vấn đứng ở ClientRead).
 * - max: 10 — truy vấn song song đi trên các kết nối riêng.
 * - idle_timeout / max_lifetime — bỏ kết nối nhàn rỗi/cũ trước khi pooler hoặc lúc hàm "ngủ" làm nó chết.
 * - connect_timeout — lỗi nhanh thay vì treo khi không kết nối được.
 */
const client = postgres(process.env.DATABASE_URL!, {
  prepare: false,
  max: 10,
  max_pipeline: 1,
  idle_timeout: 20,
  max_lifetime: 60 * 5,
  connect_timeout: 10,
});
export const db = drizzle(client, { schema });
export * as tables from './schema';
