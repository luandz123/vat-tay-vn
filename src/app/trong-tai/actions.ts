'use server';

/** Action của tablet trọng tài: xác thực bằng mã bàn (không cần tài khoản). */
import { revalidatePath } from 'next/cache';
import { publish, tableChannel, tournamentChannel } from '@/lib/realtime';
import { addMatchEvent, autoAssignTables, recordResult, tableByCode, undoResult } from '@/server/brackets/service';
import { AppError } from '@/server/shared/errors';
import { toResult, type ActionResult } from '../_lib/action-result';

async function withTable<T>(code: string, fn: (tableId: string) => Promise<{ tournamentId: string } & T>): Promise<ActionResult<undefined>> {
  return toResult(async () => {
    const table = await tableByCode(code);
    if (!table) throw new AppError('FORBIDDEN', 'Link tablet không còn hiệu lực. Hãy xin BTC link mới.');
    const r = await fn(table.id);
    // Bàn vừa trống chỗ → tự gán trận tiếp theo (nếu giải bật tự động)
    await autoAssignTables(r.tournamentId).catch((e) => console.error('autoAssign', e));
    revalidatePath(`/trong-tai/${code}`);
    await Promise.allSettled([
      publish(tournamentChannel(r.tournamentId), { type: 'match.updated', matchId: '', version: 0 }),
      publish(tableChannel(table.id), { type: 'table.updated', tableId: table.id }),
    ]);
    return undefined;
  });
}

export async function refereeResultAction(code: string, raw: unknown) {
  return withTable(code, (tableId) => recordResult({ tableId }, raw));
}
export async function refereeUndoAction(code: string, raw: unknown) {
  return withTable(code, (tableId) => undoResult({ tableId }, raw));
}
export async function refereeEventAction(code: string, raw: unknown) {
  return withTable(code, (tableId) => addMatchEvent({ tableId }, raw));
}
