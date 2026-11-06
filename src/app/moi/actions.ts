'use server';

import { requireUser } from '@/lib/auth';
import { acceptInvite } from '@/server/organizations/members';
import { toResult } from '../_lib/action-result';

export async function acceptInviteAction(token: string) {
  return toResult(async () => ({ organizationId: await acceptInvite((await requireUser()).id, token) }));
}
