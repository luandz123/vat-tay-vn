/**
 * Lớp bọc realtime. Chỉ file này được import Supabase Realtime.
 * Kênh: `tournament:<id>` (BTC, khán giả) và `table:<id>` (tablet trọng tài).
 * Khi chuyển sang NestJS: thay bằng Socket.IO, giữ nguyên publish/subscribe.
 */
import { createClient, type RealtimeChannel } from '@supabase/supabase-js';

export type RealtimeEvent =
  | { type: 'match.updated'; matchId: string; version: number }
  | { type: 'table.updated'; tableId: string }
  | { type: 'registration.paid'; registrationId: string };

export const tournamentChannel = (tournamentId: string) => `tournament:${tournamentId}`;
export const tableChannel = (tableId: string) => `table:${tableId}`;

/** Server: phát sự kiện (qua REST broadcast, không giữ kết nối). */
export async function publish(channel: string, event: RealtimeEvent): Promise<void> {
  if (typeof window !== 'undefined') throw new Error('publish() chỉ gọi từ server');
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
    },
    body: JSON.stringify({ messages: [{ topic: channel, event: event.type, payload: event }] }),
  });
  if (!res.ok) throw new Error(`Realtime publish lỗi ${res.status}`);
}

let browserClient: ReturnType<typeof createClient> | null = null;

/** Client: nghe sự kiện. Trả về hàm hủy đăng ký. */
export function subscribe(channel: string, onEvent: (e: RealtimeEvent) => void): () => void {
  browserClient ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const ch: RealtimeChannel = browserClient
    .channel(channel)
    .on('broadcast', { event: '*' }, ({ payload }) => onEvent(payload as RealtimeEvent))
    .subscribe();
  return () => {
    void browserClient?.removeChannel(ch);
  };
}
