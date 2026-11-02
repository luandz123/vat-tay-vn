import { ZodError } from 'zod';
import { AppError } from '@/server/shared/errors';

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fields?: Record<string, string> };

/** Bọc lời gọi service: đổi lỗi nghiệp vụ / validate thành dữ liệu hiển thị được, lỗi lạ thì báo chung. */
export async function toResult<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof ZodError) {
      const fields: Record<string, string> = {};
      for (const issue of e.issues) {
        const key = issue.path.join('.');
        if (!fields[key]) fields[key] = issue.message;
      }
      return { ok: false, error: 'Vui lòng kiểm tra lại các ô được đánh dấu', fields };
    }
    if (e instanceof AppError) return { ok: false, error: e.message };
    if (e instanceof Error && e.message === 'UNAUTHENTICATED') return { ok: false, error: 'Phiên đăng nhập đã hết, hãy đăng nhập lại' };
    console.error(e);
    return { ok: false, error: 'Có lỗi xảy ra, vui lòng thử lại' };
  }
}
