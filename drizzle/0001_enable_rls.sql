-- Chặn Data API (PostgREST) của Supabase: anon/authenticated không đọc/ghi trực tiếp được bảng nào.
-- Ứng dụng kết nối Postgres trực tiếp bằng role postgres nên không bị ảnh hưởng.
-- Phân quyền thật nằm ở server code (CLAUDE.md, quy tắc 4).
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t.tablename);
  END LOOP;
END $$;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
