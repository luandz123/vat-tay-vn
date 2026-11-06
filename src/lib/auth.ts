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
/**
 * Chỉ cho test end-to-end ở máy: cookie `e2e_user=<users.id>` thay cho đăng nhập Supabase.
 * Bật khi E2E_ALLOW_FAKE_AUTH=1 và KHÔNG chạy trên Vercel.
 */
async function e2eUser(): Promise<AppUser | null | undefined> {
  if (process.env.E2E_ALLOW_FAKE_AUTH !== '1' || process.env.VERCEL) return undefined;
  const { cookies } = await import('next/headers');
  const id = (await cookies()).get('e2e_user')?.value;
  if (!id) return null;
  const [{ db }, { users }, { eq }] = await Promise.all([import('@/db'), import('@/db/schema'), import('drizzle-orm')]);
  return (await db.query.users.findFirst({ where: eq(users.id, id) })) ?? null;
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const fake = await e2eUser();
  if (fake !== undefined) return fake;
  const supabase = await serverClient();
  const { data } = await supabase.auth.getUser();
  const authUser = data.user;
  if (!authUser) return null;

  // Import lười: middleware (edge runtime) dùng file này nhưng không được kéo driver Postgres vào.
  const [{ db }, { users }, { eq }] = await Promise.all([import('@/db'), import('@/db/schema'), import('drizzle-orm')]);

  const existing = await db.query.users.findFirst({ where: eq(users.authSubject, authUser.id) });
  if (existing) return existing;

  // ADMIN_EMAILS (phân tách bằng dấu phẩy): tài khoản tự thành admin nền tảng ở lần đăng nhập đầu
  const admins = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  const [created] = await db
    .insert(users)
    .values({
      authSubject: authUser.id,
      email: authUser.email ?? null,
      fullName: (authUser.user_metadata?.full_name as string | undefined) ?? null,
      role: authUser.email && admins.includes(authUser.email.toLowerCase()) ? 'admin' : 'user',
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
  if (!(await googleEnabled())) throw new AuthError('Đăng nhập Google chưa được bật');
  const supabase = await serverClient();
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  if (error) throw authError(error);
  return data.url;
}

/** Google đã được bật trong cấu hình đăng nhập chưa (đọc cấu hình công khai, cache 60 giây). */
export async function googleEnabled(): Promise<boolean> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return false;
  try {
    const res = await fetch(`${url()}/auth/v1/settings`, { headers: { apikey: anonKey() }, next: { revalidate: 60 } });
    if (!res.ok) return false;
    const s = (await res.json()) as { external?: { google?: boolean } };
    return !!s.external?.google;
  } catch {
    return false;
  }
}

const AUTH_ERRORS: [RegExp, string][] = [
  [/invalid login credentials/i, 'Sai email hoặc mật khẩu'],
  [/already (been )?registered|already exists/i, 'Email này đã có tài khoản — hãy chọn "Đăng nhập"'],
  [/password should be at least/i, 'Mật khẩu tối thiểu 6 ký tự'],
  [/rate limit|too many/i, 'Thử quá nhiều lần, vui lòng đợi vài phút'],
  [/email not confirmed/i, 'Email chưa được xác nhận'],
];
export class AuthError extends Error {}
const authError = (e: { message: string }) => new AuthError(AUTH_ERRORS.find(([re]) => re.test(e.message))?.[1] ?? 'Đăng nhập không thành công, thử lại sau');

/** Đăng nhập bằng email + mật khẩu. */
export async function signInWithPassword(email: string, password: string): Promise<void> {
  const supabase = await serverClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw authError(error);
}

/** Tạo tài khoản bằng email + mật khẩu (không cần email xác nhận) rồi đăng nhập luôn. */
export async function signUpWithPassword(email: string, password: string, fullName: string): Promise<void> {
  const supabase = await serverClient();
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
  if (error) throw authError(error);
  // Supabase trả user không có identities khi email đã tồn tại (chống dò email)
  if (data.user && data.user.identities?.length === 0) throw authError({ message: 'already registered' });
  if (!data.session) {
    const r = await supabase.auth.signInWithPassword({ email, password });
    if (r.error) throw authError(r.error);
  }
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
