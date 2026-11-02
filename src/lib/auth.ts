/**
 * Lớp bọc đăng nhập. Chỉ file này được import Supabase Auth.
 * Khi chuyển sang NestJS: thay phần thân các hàm (Auth.js/Passport), giữ nguyên chữ ký.
 */
import { createServerClient } from '@supabase/ssr';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { users } from '@/db/schema';

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function serverClient() {
  const { cookies } = await import('next/headers');
  const store = await cookies();
  return createServerClient(url(), anonKey(), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Gọi từ Server Component: không ghi được cookie, middleware sẽ làm mới phiên.
        }
      },
    },
  });
}

export type AppUser = typeof users.$inferSelect;

/** Người dùng hiện tại (bảng users của mình), tự tạo bản ghi ở lần đăng nhập đầu. */
export async function getCurrentUser(): Promise<AppUser | null> {
  const supabase = await serverClient();
  const { data } = await supabase.auth.getUser();
  const authUser = data.user;
  if (!authUser) return null;

  // Import lười: middleware (edge runtime) dùng file này nhưng không được kéo driver Postgres vào.
  const [{ db }, { users }, { eq }] = await Promise.all([import('@/db'), import('@/db/schema'), import('drizzle-orm')]);

  const existing = await db.query.users.findFirst({ where: eq(users.authSubject, authUser.id) });
  if (existing) return existing;

  const [created] = await db
    .insert(users)
    .values({
      authSubject: authUser.id,
      email: authUser.email ?? null,
      fullName: (authUser.user_metadata?.full_name as string | undefined) ?? null,
    })
    .onConflictDoNothing({ target: users.authSubject })
    .returning();
  return created ?? (await db.query.users.findFirst({ where: eq(users.authSubject, authUser.id) })) ?? null;
}

export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHENTICATED');
  return user;
}

/** URL để chuyển người dùng sang đăng nhập Google. */
export async function signInWithGoogleUrl(redirectTo: string): Promise<string> {
  const supabase = await serverClient();
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  if (error) throw error;
  return data.url;
}

/** Gửi link đăng nhập qua email (không mật khẩu). */
export async function sendMagicLink(email: string, redirectTo: string): Promise<void> {
  const supabase = await serverClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
  if (error) throw error;
}

/** Đổi mã từ callback OAuth/magic link thành phiên. */
export async function completeSignIn(code: string): Promise<void> {
  const supabase = await serverClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const supabase = await serverClient();
  await supabase.auth.signOut();
}

/** Dùng trong middleware.ts: làm mới cookie phiên trên mỗi request. */
export async function refreshSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return response;
  const supabase = createServerClient(url(), anonKey(), {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}
