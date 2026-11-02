/** Hiển thị bảng đấu theo cột vòng (dùng cho BTC, khán giả). Không có tương tác mặc định. */
import type { ReactNode } from 'react';
import { cx } from '@/components/ui';
import { roundLabel, type BoardDTO, type CategoryBoardDTO, type MatchDTO } from '@/server/brackets/dto';

export function BracketView({
  category,
  entries,
  tables,
  renderActions,
  renderEntry,
  highlight,
}: {
  category: CategoryBoardDTO;
  entries: BoardDTO['entries'];
  tables: BoardDTO['tables'];
  renderActions?: (m: MatchDTO) => ReactNode;
  renderEntry?: (entryId: string, m: MatchDTO, slot: 'red' | 'blue') => ReactNode;
  highlight?: string | null;
}) {
  const ms = category.matches.filter((m) => m.status !== 'skipped');
  const sections: { title: string; side: MatchDTO['side'][] }[] =
    category.bracket?.type === 'double'
      ? [
          { title: 'Nhánh thắng', side: ['winners'] },
          { title: 'Nhánh thua', side: ['losers'] },
          { title: 'Chung kết tổng', side: ['grand_final'] },
        ]
      : [{ title: '', side: ['winners', 'third_place'] }];
  const wbMax = Math.max(0, ...ms.filter((m) => m.side === 'winners').map((m) => m.round));

  return (
    <div className="flex flex-col gap-6">
      {sections.map((sec) => {
        const inSec = ms.filter((m) => sec.side.includes(m.side));
        if (!inSec.length) return null;
        const cols = [...new Set(inSec.map((m) => `${m.side}:${m.round}`))].sort((a, b) => {
          const [sa, ra] = a.split(':');
          const [sb, rb] = b.split(':');
          return sa === sb ? Number(ra) - Number(rb) : sa === 'third_place' ? 1 : -1;
        });
        return (
          <div key={sec.title || 'main'} className="flex flex-col gap-2">
            {sec.title && <h3 className="display text-lg text-muted">{sec.title}</h3>}
            <div className="overflow-x-auto pb-2">
              <div className="grid gap-5" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(220px, 1fr))`, minWidth: cols.length * 240 }}>
                {cols.map((col) => {
                  const [side, round] = col.split(':') as [MatchDTO['side'], string];
                  const list = inSec.filter((m) => m.side === side && m.round === Number(round)).sort((a, b) => a.number - b.number);
                  return (
                    <div key={col} className="flex flex-col gap-2.5">
                      <div className="display text-sm text-muted">{roundLabel(side, Number(round), wbMax)}</div>
                      <div className="flex flex-1 flex-col justify-around gap-3">
                        {list.map((m) => (
                          <MatchCard key={m.id} m={m} entries={entries} tables={tables} actions={renderActions?.(m)} renderEntry={renderEntry} highlight={highlight} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const STATUS: Record<MatchDTO['status'], string> = {
  pending: 'Chờ', ready: 'Chờ bàn', on_table: 'Trên bàn', in_progress: 'Đang đấu', finished: 'Xong', bye: 'Miễn đấu', skipped: 'Không cần',
};

export function MatchCard({
  m,
  entries,
  tables,
  actions,
  renderEntry,
  highlight,
}: {
  m: MatchDTO;
  entries: BoardDTO['entries'];
  tables: BoardDTO['tables'];
  actions?: ReactNode;
  renderEntry?: (entryId: string, m: MatchDTO, slot: 'red' | 'blue') => ReactNode;
  highlight?: string | null;
}) {
  const live = m.status === 'in_progress' || m.status === 'on_table';
  const table = tables.find((t) => t.id === m.tableId);
  const row = (slot: 'red' | 'blue') => {
    const id = slot === 'red' ? m.red : m.blue;
    const won = !!id && m.winner === id;
    const lost = !!id && !!m.winner && m.winner !== id;
    return (
      <div className={cx('flex items-center gap-2 border-t border-line px-2.5 py-2', won && 'bg-[#14241a]', highlight && id === highlight && 'outline outline-2 -outline-offset-2 outline-gold')}>
        <span className={cx('h-5 w-1 shrink-0', slot === 'red' ? 'bg-corner-red' : 'bg-corner-blue')} aria-hidden="true" />
        {id && renderEntry ? (
          renderEntry(id, m, slot)
        ) : (
          <span className={cx('flex-1 truncate text-sm', won ? 'font-bold' : lost ? 'text-muted' : '')}>
            {id ? entries[id]?.name ?? '—' : m.status === 'bye' ? '(miễn)' : '…'}
          </span>
        )}
        {won && <span className="text-[11px] font-bold text-success-text">THẮNG</span>}
      </div>
    );
  };
  return (
    <div className={cx('border bg-[#0f1116]', live ? 'border-brand' : 'border-line')}>
      <div className={cx('flex justify-between px-2.5 py-1 text-[11px] uppercase tracking-wider', live ? 'bg-brand text-white' : 'bg-[#1a1c24] text-muted')}>
        <span>Trận {m.number}{table ? ` · ${table.name}` : ''}</span>
        <span>{STATUS[m.status]}</span>
      </div>
      {row('red')}
      {row('blue')}
      {actions && <div className="flex flex-wrap gap-1.5 border-t border-line p-2">{actions}</div>}
    </div>
  );
}
