'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { subscribe, tournamentChannel } from '@/lib/realtime';

/** Làm mới dữ liệu trang khi có sự kiện realtime của giải; kèm hỏi định kỳ phòng khi mất kết nối. */
export function LiveRefresh({ tournamentId, intervalMs = 15000 }: { tournamentId: string; intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    let off = () => {};
    try {
      off = subscribe(tournamentChannel(tournamentId), () => router.refresh());
    } catch {
      // chưa cấu hình realtime: chỉ dùng hỏi định kỳ
    }
    const t = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, intervalMs);
    return () => {
      off();
      clearInterval(t);
    };
  }, [tournamentId, intervalMs, router]);
  return null;
}
