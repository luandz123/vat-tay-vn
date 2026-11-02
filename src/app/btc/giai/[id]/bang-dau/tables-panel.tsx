'use client';

import { useState, useTransition } from 'react';
import { createTableAction, deleteTableAction, issueTableCodeAction, updateTableAction } from '@/app/btc/bracket-actions';
import { Alert, Button, Card, cx, inputClass } from '@/components/ui';
import type { BoardDTO } from '@/server/brackets/dto';

export function TablesPanel({ tournamentId, board, site }: { tournamentId: string; board: BoardDTO; site: string }) {
  const [name, setName] = useState('');
  const [links, setLinks] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const all = board.categories.flatMap((c) => c.matches.map((m) => ({ m, c })));
  const label = (id: string | null) => (id ? board.entries[id]?.name ?? '—' : '…');

  return (
    <Card title="Các bàn đấu">
      {board.tables.length === 0 && <p className="text-sm text-muted">Thêm bàn để gán trận và mở tablet trọng tài.</p>}
      {board.tables.map((t) => {
        const onTable = all.filter(({ m }) => m.tableId === t.id && ['on_table', 'in_progress'].includes(m.status)).sort((a, b) => (a.m.queuePosition ?? 0) - (b.m.queuePosition ?? 0));
        const cur = onTable[0];
        const live = cur?.m.status === 'in_progress';
        return (
          <div key={t.id} className={cx('flex flex-col gap-2 border p-3', live ? 'border-brand' : 'border-line-strong')}>
            <div className="flex items-center gap-2">
              <span className="display text-lg">{t.name}</span>
              <span className={cx('px-2 py-0.5 text-xs font-bold', t.status === 'paused' ? 'bg-surface-2 text-fg-2' : live ? 'bg-brand text-white' : cur ? 'bg-[#3a2a0b] text-[#f7c948]' : 'bg-surface-2 text-fg-2')}>
                {t.status === 'paused' ? 'Tạm nghỉ' : live ? 'Đang đấu' : cur ? 'Chờ bắt đầu' : 'Trống'}
              </span>
              <input
                aria-label={`Trọng tài ${t.name}`}
                defaultValue={t.refereeName ?? ''}
                placeholder="Tên trọng tài"
                onBlur={(e) => e.target.value !== (t.refereeName ?? '') && start(async () => { await updateTableAction(tournamentId, t.id, { refereeName: e.target.value || null }); })}
                className="ml-auto min-h-8 w-32 border border-line-strong bg-bg px-2 text-xs"
              />
            </div>
            <div className="text-sm">{cur ? `${cur.c.label} · T${cur.m.number}: ${label(cur.m.red)} vs ${label(cur.m.blue)}` : 'Chưa có trận'}</div>
            {onTable.length > 1 && <div className="text-xs text-muted">Hàng chờ: {onTable.slice(1).map(({ m }) => `T${m.number}`).join(', ')}</div>}
            <div className="flex flex-wrap gap-1.5">
              <Button
                className="min-h-8 text-xs"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    if (t.hasCode && !confirm('Tạo link mới sẽ làm link tablet cũ hết hiệu lực. Tiếp tục?')) return;
                    const r = await issueTableCodeAction(tournamentId, t.id);
                    if (r.ok) setLinks({ ...links, [t.id]: `${site}/trong-tai/${r.data}` });
                    else setError(r.error);
                  })
                }
              >
                {t.hasCode ? 'Link tablet mới' : 'Tạo link tablet'}
              </Button>
              <Button className="min-h-8 text-xs" disabled={pending} onClick={() => start(async () => { await updateTableAction(tournamentId, t.id, { status: t.status === 'active' ? 'paused' : 'active' }); })}>
                {t.status === 'active' ? 'Tạm nghỉ' : 'Mở lại'}
              </Button>
              <Button className="min-h-8 text-xs" disabled={pending} onClick={() => start(async () => { if (confirm(`Xóa ${t.name}?`)) { const r = await deleteTableAction(tournamentId, t.id); if (!r.ok) setError(r.error); } })}>
                Xóa
              </Button>
            </div>
            {links[t.id] && (
              <div className="flex flex-col gap-1 bg-bg p-2 text-xs">
                <span className="text-fg-2">Mở link này trên tablet của bàn (chỉ hiện một lần):</span>
                <code className="break-all font-bold text-fg">{links[t.id]}</code>
                <button type="button" className="self-start font-semibold text-brand-text" onClick={() => navigator.clipboard.writeText(links[t.id]!)}>Copy link</button>
              </div>
            )}
          </div>
        );
      })}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await createTableAction(tournamentId, name || `Bàn ${board.tables.length + 1}`);
            if (r.ok) setName('');
            else setError(r.error);
          });
        }}
      >
        <input aria-label="Tên bàn mới" className={`${inputClass} min-h-10`} value={name} onChange={(e) => setName(e.target.value)} placeholder={`Bàn ${board.tables.length + 1}`} />
        <Button type="submit" disabled={pending}>+ Thêm bàn</Button>
      </form>
      {error && <Alert tone="error">{error}</Alert>}
    </Card>
  );
}
