'use server';

import { z } from 'zod';
import { sendMagicLink } from '@/lib/auth';
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
