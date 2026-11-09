'use server';

import { revalidatePath } from 'next/cache';
import { toResult, type ActionResult } from '@/app/_lib/action-result';
import { getCurrentUser } from '@/lib/auth';
import { AppError } from '@/server/shared/errors';
import { register } from '@/server/registration/service';
import { getPublicTournament } from '@/server/tournaments/service';

export async function registerAction(slug: string, raw: Record<string, unknown>): Promise<ActionResult<{ token: string }>> {
  return toResult(async () => {
    if (raw.website) throw new AppError('INVALID', 'Không gửi được'); // bẫy bot
    const user = await getCurrentUser();
    if (!user) throw new AppError('UNAUTHENTICATED', 'Vui lòng đăng nhập để đăng ký');
    const d = await getPublicTournament(slug);
    if (!d) throw new AppError('NOT_FOUND', 'Không tìm thấy giải');
    const { registration } = await register(d.tournament.id, raw, { source: 'online', athleteUserId: user.id });
    revalidatePath(`/${slug}`);
    return { token: registration.ticketToken };
  });
}
