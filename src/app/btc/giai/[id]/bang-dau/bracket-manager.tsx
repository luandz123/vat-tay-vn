'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import type { ActionResult } from '@/app/_lib/action-result';
import {
  assignTableAction,
  btcResultAction,
  btcUndoAction,
  generateBracketAction,
  lockBracketAction,
  setAutoAssignAction,
  swapEntriesAction,
} from '@/app/btc/bracket-actions';
import { BracketView } from '@/components/bracket-view';
import { Alert, Button, Card, cx } from '@/components/ui';
import type { BoardDTO, MatchDTO } from '@/server/brackets/dto';
import { HAND_LABEL, HAND_SHORT } from '@/server/tournaments/templates';
import { TablesPanel } from './tables-panel';

export function BracketManager({ tournamentId, autoAssign, board, selectedId, site, slug }: { tournamentId: string; autoAssign: boolean; board: BoardDTO; selectedId: string | null; site: string; slug: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [dragging, setDragging] = useState<string>();
  const [opts, setOpts] = useState({ type: 'double' as 'single' | 'double', thirdPlaceMatch: true, grandFinalReset: true, onlyCheckedIn: true });
  const cat = board.categories.find((c) => c.id === selectedId) ?? board.categories[0];
  const act = (fn: () => Promise<ActionResult<unknown>>) =>
    start(async () => {
      const r = await fn();
      setError(r.ok ? undefined : r.error);
    });

  const draft = cat?.bracket?.status === 'draft';
  const waiting = board.categories.flatMap((c) => c.matches.filter((m) => m.status === 'ready').map((m) => ({ m, c })));

  const actions = (m: MatchDTO) => {
    if (m.status === 'finished')
      return (
        <button type="button" className="text-xs font-semibold text-fg-2 underline" disabled={pending} onClick={() => act(() => btcUndoAction(tournamentId, { matchId: m.id, clientEventId: crypto.randomUUID() }))}>
          Hoàn tác
        </button>
      );
    if (!['ready', 'on_table', 'in_progress'].includes(m.status)) return null;
    return (
      <>
        <label className="sr-only" htmlFor={`b-${m.id}`}>Bàn cho trận {m.number}</label>
        <select
          id={`b-${m.id}`}
          className="min-h-8 flex-1 border border-line-strong bg-bg px-1.5 text-xs"
          value={m.tableId ?? ''}
          disabled={pending || m.status === 'in_progress'}
          onChange={(e) => act(() => assignTableAction(tournamentId, m.id, e.target.value || null))}
        >
          <option value="">Chưa gán bàn</option>
          {board.tables.filter((t) => t.status === 'active').map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {(['red', 'blue'] as const).map((s) => (
          <button
            key={s}
            type="button"
            title="BTC nhập kết quả thay trọng tài"
            className={cx('min-h-8 px-2 text-xs font-bold text-white', s === 'red' ? 'bg-corner-red' : 'bg-corner-blue')}
            disabled={pending}
            onClick={() => {
              const w = s === 'red' ? m.red : m.blue;
              if (w && confirm(`${board.entries[w]?.name} thắng trận ${m.number}?`)) act(() => btcResultAction(tournamentId, { matchId: m.id, winnerEntryId: w, version: m.version, clientEventId: crypto.randomUUID() }));
            }}
          >
            {s === 'red' ? 'Đỏ' : 'Xanh'} thắng
          </button>
        ))}
      </>
    );
  };

  return (
    <main className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="display text-3xl">Bảng đấu &amp; bàn</h1>
        <span className="flex items-center gap-1.5 text-sm text-success-text"><span className="size-2 rounded-full bg-success" />Khán giả xem trực tiếp</span>
        <a href={`/${slug}/man-hinh`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand-text">Màn hình gọi VĐV (chiếu TV) ↗</a>
        <label className="ml-auto flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={autoAssign}
            disabled={pending}
            onChange={(e) => act(() => setAutoAssignAction(tournamentId, e.target.checked))}
            className="size-5 accent-[var(--brand)]"
          />
          Tự động gán trận vào bàn trống
        </label>
      </div>
      {autoAssign && (
        <p className="-mt-2 text-sm text-muted">
          Mỗi bàn giữ 1 trận đang đấu + 1 trận chuẩn bị. Chỉ hạng đã <strong>khóa bảng</strong> mới được tự gán. VĐV vừa đấu được nghỉ ít nhất 5 phút nếu còn trận khác.
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {board.categories.map((c) => (
          <Link
            key={c.id}
            href={`?hang=${c.id}`}
            scroll={false}
            className={cx('flex min-h-10 items-center gap-1.5 border border-line-strong px-3 text-sm font-semibold', c.id === cat?.id ? 'bg-fg text-bg' : 'bg-surface')}
          >
            {HAND_SHORT[c.hand]} · {c.gender === 'female' ? 'Nữ' : c.gender === 'male' ? 'Nam' : 'Mở'} {c.label}
            <span className={cx('text-xs', c.bracket?.status === 'finished' ? 'text-success' : c.bracket?.status === 'in_progress' ? 'text-brand-text' : 'text-muted')}>
              {c.bracket ? { draft: 'nháp', locked: 'đã khóa', in_progress: 'đang đấu', finished: 'xong' }[c.bracket.status] : `${c.checkedInCount}/${c.entrantCount}`}
            </span>
          </Link>
        ))}
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="flex flex-wrap items-start gap-5">
        <section className="flex min-w-0 flex-[999_1_640px] flex-col gap-4">
          {!cat ? (
            <p className="text-fg-2">Giải chưa có hạng mục.</p>
          ) : (
            <Card
              title={`${HAND_LABEL[cat.hand]} · ${cat.label}`}
              actions={<span className="text-sm text-muted">{cat.checkedInCount} đã check-in / {cat.entrantCount} đăng ký</span>}
            >
              {(!cat.bracket || draft) && (
                <div className="flex flex-wrap items-center gap-3 border border-line-strong p-3 text-sm">
                  <div className="flex">
                    {(['double', 'single'] as const).map((t) => (
                      <button key={t} type="button" aria-pressed={opts.type === t} onClick={() => setOpts({ ...opts, type: t })} className={cx('min-h-9 border border-line-strong px-3 font-bold', opts.type === t ? 'bg-fg text-bg' : '')}>
                        {t === 'single' ? 'Loại trực tiếp' : 'Loại kép (nhánh thắng/thua)'}
                      </button>
                    ))}
                  </div>
                  {opts.type === 'single' ? (
                    <label className="flex items-center gap-1.5"><input type="checkbox" checked={opts.thirdPlaceMatch} onChange={(e) => setOpts({ ...opts, thirdPlaceMatch: e.target.checked })} className="size-4 accent-[var(--brand)]" />Tranh hạng 3</label>
                  ) : (
                    <label className="flex items-center gap-1.5"><input type="checkbox" checked={opts.grandFinalReset} onChange={(e) => setOpts({ ...opts, grandFinalReset: e.target.checked })} className="size-4 accent-[var(--brand)]" />Đấu lại chung kết</label>
                  )}
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={opts.onlyCheckedIn} onChange={(e) => setOpts({ ...opts, onlyCheckedIn: e.target.checked })} className="size-4 accent-[var(--brand)]" />Chỉ VĐV đã check-in</label>
                  <Button variant="primary" className="ml-auto" disabled={pending} onClick={() => { if (!cat.bracket || confirm('Bốc thăm lại sẽ xóa bảng hiện tại. Tiếp tục?')) act(() => generateBracketAction(tournamentId, cat.id, opts)); }}>
                    {cat.bracket ? 'Bốc thăm lại' : 'Bốc thăm & tạo bảng'}
                  </Button>
                </div>
              )}
              {cat.bracket && (
                <>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-fg-2">
                    <span>{cat.bracket.type === 'single' ? 'Loại trực tiếp' : 'Loại kép (nhánh thắng/thua)'}</span>
                    {draft && <span>· Kéo tên VĐV ở vòng 1 thả lên người khác để đổi chỗ.</span>}
                    {(cat.bracket.status === 'draft' || cat.bracket.status === 'locked') && (
                      <Button className="ml-auto min-h-9" disabled={pending} onClick={() => act(() => lockBracketAction(tournamentId, cat.bracket!.id, cat.bracket!.status === 'draft'))}>
                        {cat.bracket.status === 'draft' ? 'Khóa bảng & bắt đầu thi đấu' : 'Mở khóa'}
                      </Button>
                    )}
                  </div>
                  {cat.results.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {cat.results.map((r) => (
                        <span key={r.entryId} className={cx('px-2.5 py-1 text-sm font-bold', r.place === 1 ? 'bg-gold text-bg' : r.place === 2 ? 'bg-fg-2 text-bg' : r.place === 3 ? 'bg-[#e08a4b] text-bg' : 'bg-surface-2')}>
                          {['', 'HCV', 'HCB', 'HCĐ', 'KK'][r.place] ?? r.place} · {board.entries[r.entryId]?.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <BracketView
                    category={cat}
                    entries={board.entries}
                    tables={board.tables}
                    renderActions={actions}
                    renderEntry={
                      draft
                        ? (id, m) =>
                            m.side === 'winners' && m.round === 1 ? (
                              <span
                                draggable
                                onDragStart={() => setDragging(id)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => {
                                  if (dragging && dragging !== id) act(() => swapEntriesAction(tournamentId, cat.bracket!.id, dragging, id));
                                  setDragging(undefined);
                                }}
                                className="flex-1 cursor-grab truncate text-sm"
                              >
                                ⠿ {board.entries[id]?.name}
                              </span>
                            ) : (
                              <span className="flex-1 truncate text-sm">{board.entries[id]?.name}</span>
                            )
                        : undefined
                    }
                  />
                </>
              )}
            </Card>
          )}
        </section>

        <aside className="flex w-full flex-col gap-4 xl:w-[360px]">
          <TablesPanel tournamentId={tournamentId} board={board} site={site} />
          <Card title={`Trận chờ gán bàn (${waiting.length})`}>
            {autoAssign && waiting.length > 0 && <p className="text-xs text-muted">Các trận này đang chờ bàn trống, hoặc thuộc hạng chưa khóa bảng.</p>}
            {waiting.length === 0 && <p className="text-sm text-muted">Không có.</p>}
            {waiting.slice(0, 20).map(({ m, c }) => (
              <div key={m.id} className="flex items-center gap-2 bg-surface-2 px-2.5 py-2 text-sm">
                <span className="flex-1 truncate">{board.entries[m.red!]?.name} vs {board.entries[m.blue!]?.name}</span>
                <span className="shrink-0 text-xs text-muted">{c.label} · T{m.number}</span>
                <select aria-label="Gán bàn" className="min-h-8 border border-line-strong bg-bg text-xs" value="" disabled={pending} onChange={(e) => e.target.value && act(() => assignTableAction(tournamentId, m.id, e.target.value))}>
                  <option value="">Bàn…</option>
                  {board.tables.filter((t) => t.status === 'active').map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            ))}
          </Card>
        </aside>
      </div>
    </main>
  );
}
