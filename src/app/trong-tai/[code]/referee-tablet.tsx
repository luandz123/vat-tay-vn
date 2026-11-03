'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { cx } from '@/components/ui';
import { refereeEventAction, refereeHoldAction, refereeResultAction, refereeUndoAction } from '../actions';

interface Side {
  id: string;
  name: string;
  club: string | null;
  kg: number | null;
  foul: number;
  warning: number;
}

export function RefereeTablet({
  code,
  tableName,
  refereeName,
  tournamentName,
  current,
  next,
  last,
}: {
  code: string;
  tableName: string;
  refereeName: string | null;
  tournamentName: string;
  current: { id: string; number: number; version: number; status: string; title: string; red: Side | null; blue: Side | null } | null;
  next: string[];
  last: { id: string; winner: string; number: number } | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [justWon, setJustWon] = useState<{ name: string; corner: 'red' | 'blue' }>();
  const [holding, setHolding] = useState(false);
  // Giữ clientEventId khi gửi lại (mất mạng) để không ghi trùng
  const pendingEvent = useRef<string | null>(null);

  function send(fn: (id: string) => Promise<{ ok: boolean; error?: string }>, onOk?: () => void) {
    const id = pendingEvent.current ?? crypto.randomUUID();
    pendingEvent.current = id;
    start(async () => {
      try {
        const r = await fn(id);
        pendingEvent.current = null;
        if (r.ok) {
          setError(undefined);
          onOk?.();
          router.refresh();
        } else setError(r.error);
      } catch {
        setError('Mất kết nối. Bấm lại để gửi (sẽ không bị ghi trùng).');
      }
    });
  }

  const win = (s: Side, corner: 'red' | 'blue') =>
    send((cid) => refereeResultAction(code, { matchId: current!.id, winnerEntryId: s.id, version: current!.version, clientEventId: cid }), () => setJustWon({ name: s.name, corner }));
  const note = (s: Side, type: 'foul' | 'warning') => send((cid) => refereeEventAction(code, { matchId: current!.id, type, entryId: s.id, clientEventId: cid }));

  return (
    <main className="flex min-h-dvh flex-col bg-bg">
      <header className="flex flex-wrap items-center gap-4 border-b border-line px-5 py-3">
        <span className="display btn-slant bg-brand px-4 py-1 text-2xl text-white">{tableName}</span>
        <span className="display truncate text-xl">{current?.title ?? tournamentName}</span>
        <span className="ml-auto text-sm text-fg-2">{refereeName ? `TT: ${refereeName}` : ''}</span>
      </header>

      {error && <div role="alert" className="bg-[#2a1214] px-5 py-3 font-semibold text-[#ffb3b6]">{error}</div>}

      {justWon ? (
        <section className={cx('flex flex-1 flex-col items-center justify-center gap-5 p-6 text-center text-white', justWon.corner === 'red' ? 'bg-corner-red' : 'bg-corner-blue')}>
          <span className="text-lg uppercase tracking-[0.2em]">Đã ghi kết quả</span>
          <span className="display text-7xl leading-none sm:text-8xl">{justWon.name}</span>
          <span className="display text-4xl">Thắng</span>
          <div className="mt-4 flex flex-wrap justify-center gap-4">
            {last && (
              <button type="button" disabled={pending} onClick={() => send((cid) => refereeUndoAction(code, { matchId: last.id, clientEventId: cid }), () => setJustWon(undefined))} className="flex min-h-18 items-center gap-2 border-2 border-white bg-bg px-8 text-2xl font-bold">
                ↶ Hoàn tác
              </button>
            )}
            <button type="button" onClick={() => setJustWon(undefined)} className="display min-h-18 bg-white px-10 text-3xl text-bg">
              Trận tiếp theo →
            </button>
          </div>
          <span className="text-sm">Mọi lần sửa kết quả đều được lưu vào nhật ký</span>
        </section>
      ) : !current ? (
        <section className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <span className="display text-5xl">Chưa có trận trên bàn</span>
          <p className="text-fg-2">BTC sẽ gán trận vào {tableName}. Màn hình tự cập nhật.</p>
          {last && (
            <button type="button" disabled={pending} onClick={() => send((cid) => refereeUndoAction(code, { matchId: last.id, clientEventId: cid }))} className="min-h-14 border border-line-strong px-6 text-lg font-semibold">
              ↶ Hoàn tác trận {last.number} ({last.winner} thắng)
            </button>
          )}
        </section>
      ) : (
        <section className="grid flex-1 grid-cols-1 gap-0.5 bg-line sm:grid-cols-2">
          {([['red', current.red], ['blue', current.blue]] as const).map(([corner, s]) =>
            s ? (
              <div key={corner} className="flex flex-col gap-4 bg-[#0f1116] p-5">
                <div className="flex items-center gap-2.5">
                  <span className={cx('size-4', corner === 'red' ? 'bg-corner-red' : 'bg-corner-blue')} aria-hidden="true" />
                  <span className="text-sm uppercase tracking-[0.15em] text-fg-2">{corner === 'red' ? 'Góc đỏ' : 'Góc xanh'}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="display text-5xl leading-[0.95]">{s.name}</span>
                  <span className="text-lg text-fg-2">{[s.club, s.kg ? `${s.kg}kg` : null].filter(Boolean).join(' · ')}</span>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => win(s, corner)}
                  className={cx('display flex min-h-52 flex-1 flex-col items-center justify-center gap-1 text-6xl text-white disabled:opacity-60', corner === 'red' ? 'bg-corner-red' : 'bg-corner-blue')}
                >
                  Thắng
                  <span className="font-sans text-base font-semibold normal-case not-italic tracking-normal">Chạm để chọn {s.name.split(' ').slice(-2).join(' ')} thắng</span>
                </button>
                <div className="flex gap-2.5">
                  <button type="button" disabled={pending} onClick={() => note(s, 'foul')} className="min-h-16 flex-1 border border-line-strong bg-surface-2 text-lg font-bold">
                    + Lỗi <span className="text-[#f7c948]">({s.foul})</span>
                  </button>
                  <button type="button" disabled={pending} onClick={() => note(s, 'warning')} className="min-h-16 flex-1 border border-line-strong bg-surface-2 text-lg font-bold">
                    + Cảnh cáo <span className="text-[#f7c948]">({s.warning})</span>
                  </button>
                </div>
              </div>
            ) : (
              <div key={corner} className="flex items-center justify-center bg-[#0f1116] p-6 text-fg-2">Chờ VĐV</div>
            ),
          )}
        </section>
      )}

      {current && !justWon && (
        <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-3">
          {holding ? (
            <>
              <span className="font-semibold">Hoãn trận {current.number} (VĐV xin nghỉ):</span>
              {[3, 5, 10].map((min) => (
                <button
                  key={min}
                  type="button"
                  disabled={pending}
                  onClick={() => send((cid) => refereeHoldAction(code, { matchId: current.id, minutes: min, clientEventId: cid }), () => setHolding(false))}
                  className="min-h-12 min-w-24 border border-gold bg-warning-bg px-4 text-lg font-bold text-warning-text"
                >
                  {min} phút
                </button>
              ))}
              <button type="button" onClick={() => setHolding(false)} className="min-h-12 px-4 font-semibold text-fg-2">Hủy</button>
            </>
          ) : (
            <button type="button" onClick={() => setHolding(true)} className="min-h-12 border border-line-strong px-5 font-semibold">
              ⏸ VĐV xin nghỉ – hoãn trận
            </button>
          )}
          <span className="text-sm text-muted">Trận hoãn rời bàn, bàn tự lấy trận khác; hết giờ hoãn sẽ được xếp lại.</span>
        </div>
      )}

      <footer className="flex flex-wrap items-center gap-4 border-t border-line px-5 py-3 text-sm text-muted">
        <span>Lỗi và cảnh cáo chỉ để ghi nhận. Hệ thống không tự xử thua, trọng tài quyết định.</span>
        {next.length > 0 && <span className="ml-auto">Tiếp theo: {next.join(' · ')}</span>}
      </footer>
    </main>
  );
}
