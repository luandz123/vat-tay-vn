'use server';

import { z } from 'zod';
import { sendMagicLink, signInWithPassword, signUpWithPassword } from '@/lib/auth';
import { toResult, type ActionResult } from '../_lib/action-result';

const input = z.object({ email: z.email('Email không hợp lệ'), next: z.string().startsWith('/').default('/btc') });

export async function requestMagicLink(raw: unknown): Promise<ActionResult> {
  return toResult(async () => {
    const { email, next } = input.parse(raw);
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    await sendMagicLink(email, `${site}/auth/callback?next=${encodeURIComponent(next)}`);
    return undefined;
  });
}

const passwordInput = z.object({
  email: z.email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự').max(72),
  fullName: z.string().trim().max(80).optional(),
  mode: z.enum(['signin', 'signup']),
});

export async function passwordAuth(raw: unknown): Promise<ActionResult> {
  return toResult(async () => {
    const v = passwordInput.parse(raw);
    if (v.mode === 'signup') {
      if (!v.fullName || v.fullName.length < 2) throw new (await import('@/server/shared/errors')).AppError('INVALID', 'Nhập họ tên');
      await signUpWithPassword(v.email, v.password, v.fullName);
    } else await signInWithPassword(v.email, v.password);
    return undefined;
  });
}
