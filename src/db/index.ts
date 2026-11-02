import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Chuỗi kết nối Postgres chuẩn: Supabase hôm nay, Postgres bất kỳ khi chuyển sang NestJS.
// prepare: false để tương thích connection pooler (transaction mode) của Supabase.
const client = postgres(process.env.DATABASE_URL!, { prepare: false });
export const db = drizzle(client, { schema });
export * as tables from './schema';
