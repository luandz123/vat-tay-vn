'use server';

/** Server action bảng đấu & bàn (BTC). Sau mỗi thay đổi phát realtime để màn hình khác cập nhật. */
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { publish, tournamentChannel } from '@/lib/realtime';
import {
  assignTable,
  createTable,
  deleteTable,
  generateBracket,
  issueTableCode,
  lockBracket,
  recordResult,
  swapEntries,
  undoResult,
  updateTable,
} from '@/server/brackets/service';
import { toResult, type ActionResult } from '../_lib/action-result';

async function done(tournamentId: string) {
  revalidatePath(`/btc/giai/${tournamentId}`, 'layout');
  await publish(tournamentChannel(tournamentId), { type: 'match.updated', matchId: '', version: 0 }).catch(() => undefined);
}

const run = <T,>(tournamentId: string, fn: (userId: string) => Promise<T>): Promise<ActionResult<T>> =>
  toResult(async () => {
    const user = await requireUser();
    const out = await fn(user.id);
    await done(tournamentId);
    return out;
  });

export async function generateBracketAction(tid: string, categoryId: string, raw: unknown) {
  return run(tid, async (u) => {
    await generateBracket(u, categoryId, raw);
  });
}
export async function swapEntriesAction(tid: string, bracketId: string, a: string, b: string) {
  return run(tid, (u) => swapEntries(u, bracketId, a, b));
}
export async function lockBracketAction(tid: string, bracketId: string, locked: boolean) {
  return run(tid, (u) => lockBracket(u, bracketId, locked));
}
export async function assignTableAction(tid: string, matchId: string, tableId: string | null) {
  return run(tid, async (u) => {
    await assignTable(u, matchId, tableId);
  });
}
export async function createTableAction(tid: string, name: string) {
  return run(tid, async (u) => {
    await createTable(u, tid, name);
  });
}
export async function updateTableAction(tid: string, tableId: string, patch: { name?: string; refereeName?: string | null; status?: 'active' | 'paused' }) {
  return run(tid, (u) => updateTable(u, tableId, patch));
}
export async function deleteTableAction(tid: string, tableId: string) {
  return run(tid, (u) => deleteTable(u, tableId));
}
export async function issueTableCodeAction(tid: string, tableId: string) {
  return run(tid, (u) => issueTableCode(u, tableId));
}
export async function btcResultAction(tid: string, raw: unknown) {
  return run(tid, async (u) => {
    await recordResult({ userId: u }, raw);
  });
}
export async function btcUndoAction(tid: string, raw: unknown) {
  return run(tid, async (u) => {
    await undoResult({ userId: u }, raw);
  });
}
