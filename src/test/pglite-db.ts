/**
 * DB Postgres trong bộ nhớ (PGlite) cho integration test: chạy đúng các file migration thật.
 * Dùng: vi.mock('@/db', () => import('@/test/pglite-db')) rồi gọi resetDb() trong beforeEach.
 */
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import * as schema from '@/db/schema';

const client = new PGlite();
export const db = drizzle(client, { schema });
export * as tables from '@/db/schema';

let ready: Promise<void> | null = null;

async function migrate() {
  // Role của Supabase mà migration RLS nhắc tới.
  await client.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;`);
  const dir = path.resolve(__dirname, '../../drizzle');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    await client.exec(readFileSync(path.join(dir, f), 'utf8').replaceAll('--> statement-breakpoint', ''));
  }
}

export async function resetDb() {
  ready ??= migrate();
  await ready;
  const { rows } = await client.query<{ tablename: string }>(`select tablename from pg_tables where schemaname = 'public'`);
  await client.exec(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
}

export async function createUser(email = 'btc@vidu.com') {
  const [u] = await db.insert(schema.users).values({ authSubject: `sub-${email}`, email }).returning();
  return u!;
}
