'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { setTournamentStatus, setUserRole } from '@/server/admin/service';
import { toResult } from '../_lib/action-result';

export async function setUserRoleAction(userId: string, role: string) {
  return toResult(async () => {
    await setUserRole((await requireUser()).id, userId, role);
    revalidatePath('/admin');
  });
}
export async function setTournamentStatusAction(tournamentId: string, status: string) {
  return toResult(async () => {
    await setTournamentStatus((await requireUser()).id, tournamentId, status);
    revalidatePath('/admin');
  });
}
