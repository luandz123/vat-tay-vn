import type { Metadata } from 'next';
import { Card, buttonClass, cx } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { PLACE_LABEL, getResultsForUser } from '@/server/results/service';
import { formatVnd } from '@/server/shared/time';
import { HAND_LABEL } from '@/server/tournaments/templates';
import { FinishButton } from './finish-button';

export const metadata: Metadata = { title: 'Kết quả & bằng khen' };

const MEDAL = ['', 'bg-gold text-bg', 'bg-fg-2 text-bg', 'bg-[#e08a4b] text-bg', 'bg-surface-2 text-fg'];

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const { tournament: t, results } = await getResultsForUser(user.id, id);
  const done = results.filter((r) => r.placings.length);
  return (
    <main className="flex flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="display text-3xl">Kết quả &amp; bằng khen</h1>
        <span className="text-sm text-muted">{done.length}/{results.length} hạng đã có kết quả</span>
        <div className="ml-auto flex flex-wrap gap-2">
          {done.length > 0 && <a href={`/btc/giai/${id}/bang-khen`} target="_blank" rel="noreferrer" className={buttonClass('secondary')}>In bằng khen cả giải (PDF)</a>}
          {t.status !== 'finished' && <FinishButton tournamentId={id} />}
          {t.status === 'finished' && <span className="flex items-center px-3 font-semibold text-success-text">Giải đã kết thúc</span>}
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {results.map((r) => (
          <Card
            key={r.category.id}
            title={`${r.category.kind === 'all_around' ? '' : `${HAND_LABEL[r.category.hand]} · `}${r.category.gender === 'female' ? 'Nữ' : r.category.gender === 'male' ? 'Nam' : 'Mở'} ${r.category.label}`}
            actions={
              r.placings.length ? (
                <div className="flex gap-3 text-sm">
                  <a href={`/btc/giai/${id}/bang-khen?hang=${r.category.id}`} target="_blank" rel="noreferrer" className="font-semibold text-brand-text">Bằng khen</a>
                  <a href={`/api/giai/${t.slug}/anh-ket-qua/${r.category.id}`} target="_blank" rel="noreferrer" className="font-semibold text-brand-text">Ảnh chia sẻ</a>
                </div>
              ) : undefined
            }
          >
            {r.placings.length === 0 ? (
              <p className="text-sm text-muted">Chưa có kết quả.</p>
            ) : (
              r.placings.map((p) => (
                <div key={p.entryId} className="flex items-center gap-3">
                  <span className={cx('w-24 shrink-0 px-2 py-1 text-center text-sm font-bold', MEDAL[p.place] ?? 'bg-surface-2')}>{PLACE_LABEL[p.place]}</span>
                  <span className="flex-1"><strong>{p.name}</strong>{p.club && <span className="text-sm text-muted"> · {p.club}</span>}</span>
                  {p.prize && <span className="text-sm text-fg-2">{[p.prize.description, p.prize.cashAmount ? formatVnd(p.prize.cashAmount) : null].filter(Boolean).join(' + ')}</span>}
                </div>
              ))
            )}
          </Card>
        ))}
      </div>
    </main>
  );
}
