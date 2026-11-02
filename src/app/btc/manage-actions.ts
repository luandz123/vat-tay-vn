'use server';

/** Server action khu quản lý giải (lớp mỏng). */
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { confirmWeighIn, findByTicket, getCheckinDetail, moveEntry } from '@/server/checkin/service';
import { addExpense, deleteExpense, setFinanceVisibility } from '@/server/finance/service';
import {
  cancelRegistration,
  editRegistration,
  ignorePayment,
  matchPayment,
  recordPayment,
  setRegistrationStatus,
} from '@/server/manage/registrations';
import { broadcast, postponeTournament } from '@/server/notifications/service';
import { register } from '@/server/registration/service';
import { toResult, type ActionResult } from '../_lib/action-result';

const refresh = (id: string) => revalidatePath(`/btc/giai/${id}`, 'layout');

const run = <T,>(tournamentId: string, fn: (userId: string) => Promise<T>): Promise<ActionResult<T>> =>
  toResult(async () => {
    const user = await requireUser();
    const out = await fn(user.id);
    refresh(tournamentId);
    return out;
  });

export async function setStatusAction(tid: string, regId: string, status: 'approved' | 'rejected' | 'pending') {
  return run(tid, (u) => setRegistrationStatus(u, regId, status));
}
export async function cancelRegistrationAction(tid: string, regId: string) {
  return run(tid, (u) => cancelRegistration(u, regId));
}
export async function editRegistrationAction(tid: string, regId: string, raw: unknown) {
  return run(tid, (u) => editRegistration(u, regId, raw));
}
export async function recordPaymentAction(tid: string, regId: string, raw: unknown) {
  return run(tid, async (u) => {
    await recordPayment(u, regId, raw);
  });
}
export async function matchPaymentAction(tid: string, paymentId: string, regId: string) {
  return run(tid, (u) => matchPayment(u, paymentId, regId));
}
export async function ignorePaymentAction(tid: string, paymentId: string) {
  return run(tid, (u) => ignorePayment(u, paymentId));
}

/** Đăng ký tại sân: giá tại sân, tự duyệt; có thể ghi tiền mặt luôn. */
export async function onsiteRegisterAction(tid: string, raw: Record<string, unknown>, cash: boolean) {
  return run(tid, async (u) => {
    const { registration } = await register(tid, { ...raw, consent: true }, { source: 'onsite', actorUserId: u });
    const due = registration.amountDue - registration.amountPaid;
    if (cash && due > 0) await recordPayment(u, registration.id, { amount: due, method: 'cash' });
    return { registrationId: registration.id, code: registration.code };
  });
}

export async function findTicketAction(tid: string, scanned: string) {
  return run(tid, (u) => findByTicket(u, tid, scanned));
}
export async function checkinDetailAction(tid: string, regId: string) {
  return toResult(async () => getCheckinDetail((await requireUser()).id, tid, regId));
}
export async function confirmWeighInAction(tid: string, regId: string, kg: string) {
  return run(tid, (u) => confirmWeighIn(u, tid, regId, kg));
}
export async function moveEntryAction(tid: string, entryId: string, toCategoryId: string) {
  return run(tid, async (u) => {
    await moveEntry(u, tid, entryId, toCategoryId);
  });
}

export async function postponeAction(tid: string, raw: unknown) {
  return run(tid, async (u) => {
    const r = await postponeTournament(u, tid, raw);
    return { emailed: r.emailed, zaloText: r.zaloText };
  });
}
export async function broadcastAction(tid: string, raw: unknown) {
  return run(tid, async (u) => {
    const r = await broadcast(u, tid, raw);
    return { emailed: r.emailed, zaloText: r.zaloText };
  });
}

export async function addExpenseAction(tid: string, raw: unknown) {
  return run(tid, (u) => addExpense(u, tid, raw));
}
export async function deleteExpenseAction(tid: string, expenseId: string) {
  return run(tid, (u) => deleteExpense(u, tid, expenseId));
}
export async function setFinanceVisibilityAction(tid: string, v: string) {
  return run(tid, (u) => setFinanceVisibility(u, tid, v));
}

export async function finishTournamentAction(tid: string, force: boolean) {
  const { finishTournament } = await import('@/server/results/service');
  return run(tid, (u) => finishTournament(u, tid, force));
}
