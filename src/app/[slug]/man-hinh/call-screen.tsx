'use client';

import { useEffect, useRef, useState } from 'react';
import { cx } from '@/components/ui';
import type { BoardDTO, MatchDTO } from '@/server/brackets/dto';
import { HAND_SHORT } from '@/server/tournaments/templates';

type Data = BoardDTO & { tournament: { id: string; name: string; slug: string } };
const CALL_MS = 25_000; // ô bàn nhấp nháy "Mời lên bàn" trong 25 giây khi có trận mới

export function CallScreen({ slug, initial, host }: { slug: string; initial: Data; host: string }) {
  const [data, setData] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  const seen = useRef(new Map<string, { matchId: string; since: number }>());

  useEffect(() => {
    const t = setInterval(async () => {
      setNow(Date.now());
      const res = await fetch(`/api/giai/${slug}/truc-tiep`).catch(() => null);
      if (res?.ok) setData(await res.json());
    }, 5000);
    return () => clearInterval(t);
  }, [slug]);

  const all = data.categories.flatMap((c) => c.matches.map((m) => ({ m, c })));
  const name = (id: string | null) => (id ? data.entries[id]?.name ?? '…' : '…');
  const label = (c: Data['categories'][number]) => `${HAND_SHORT[c.hand]} · ${c.gender === 'female' ? 'Nữ' : c.gender === 'male' ? 'Nam' : 'Mở'} ${c.label}`;
  const tables = data.tables.filter((t) => t.status === 'active');

  const queueOf = (tableId: string) =>
    all
      .filter(({ m }) => m.tableId === tableId && (m.status === 'on_table' || m.status === 'in_progress'))
      .sort((a, b) => (a.m.status === 'in_progress' ? -1 : 0) - (b.m.status === 'in_progress' ? -1 : 0) || (a.m.queuePosition ?? 0) - (b.m.queuePosition ?? 0));

  // Ghi nhận khi trận đầu hàng của bàn đổi → bật "Mời lên bàn"
  for (const t of tables) {
    const cur = queueOf(t.id)[0]?.m.id;
    const prev = seen.current.get(t.id);
    if (cur && prev?.matchId !== cur) seen.current.set(t.id, { matchId: cur, since: prev ? now : 0 });
  }

  const Row = ({ m, c, big }: { m: MatchDTO; c: Data['categories'][number]; big: boolean }) => (
    <div className="flex flex-col gap-1">
      <span className={cx('uppercase tracking-widest text-fg-2', big ? 'text-xl' : 'text-base')}>{label(c)} · Trận {m.number}</span>
      <div className={cx('flex items-center gap-3 font-display font-extrabold uppercase italic leading-tight', big ? 'text-5xl' : 'text-3xl text-fg-2')}>
        <span className="h-[0.9em] w-2 shrink-0 bg-corner-red" aria-hidden="true" />
        <span className="truncate">{name(m.red)}</span>
      </div>
      <div className={cx('flex items-center gap-3 font-display font-extrabold uppercase italic leading-tight', big ? 'text-5xl' : 'text-3xl text-fg-2')}>
        <span className="h-[0.9em] w-2 shrink-0 bg-corner-blue" aria-hidden="true" />
        <span className="truncate">{name(m.blue)}</span>
      </div>
    </div>
  );

  return (
    <main className="flex min-h-dvh flex-col gap-6 bg-bg p-8">
      <header className="flex items-center justify-between">
        <h1 className="display text-5xl">{data.tournament.name}</h1>
        <span className="display flex items-center gap-2 bg-brand px-4 py-2 text-2xl text-white"><span className="size-3 rounded-full bg-white" />Trực tiếp</span>
      </header>
      {tables.length === 0 && <p className="text-3xl text-fg-2">Chưa có bàn đấu.</p>}
      <div className="grid flex-1 gap-6" style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(tables.length, 1), 3)}, minmax(0, 1fr))` }}>
        {tables.map((t) => {
          const q = queueOf(t.id);
          const cur = q[0];
          const next = q[1];
          const call = seen.current.get(t.id);
          const calling = !!cur && !!call && call.since > 0 && now - call.since < CALL_MS;
          return (
            <section key={t.id} className={cx('flex flex-col gap-6 border-4 bg-surface p-6', calling ? 'animate-pulse border-gold' : cur?.m.status === 'in_progress' ? 'border-brand' : 'border-line-strong')}>
              <div className="flex items-center justify-between">
                <span className="display btn-slant bg-brand px-5 py-1 text-4xl text-white">{t.name}</span>
                {calling && <span className="display text-3xl text-gold">Mời lên bàn!</span>}
              </div>
              {cur ? <Row m={cur.m} c={cur.c} big /> : <p className="text-3xl text-fg-2">Đang chờ trận</p>}
              {next && (
                <div className="mt-auto border-t-2 border-line-strong pt-4">
                  <span className="display mb-2 block text-2xl text-gold">Chuẩn bị</span>
                  <Row m={next.m} c={next.c} big={false} />
                </div>
              )}
            </section>
          );
        })}
      </div>
      <footer className="text-xl text-muted">Xem bảng đấu trên điện thoại: {host}/{slug}/truc-tiep</footer>
    </main>
  );
}
