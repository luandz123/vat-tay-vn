'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BracketView } from '@/components/bracket-view';
import { cx } from '@/components/ui';
import type { BoardDTO } from '@/server/brackets/dto';
import { HAND_LABEL, HAND_SHORT } from '@/server/tournaments/templates';

type Data = BoardDTO & { tournament: { id: string; name: string; slug: string } };

export function LiveBoard({ slug, initial }: { slug: string; initial: Data }) {
  const [data, setData] = useState(initial);
  const [sel, setSel] = useState(() => initial.categories.find((c) => c.bracket?.status === 'in_progress')?.id ?? initial.categories[0]?.id);
  const [updated, setUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const t = setInterval(async () => {
      if (document.hidden) return;
      const res = await fetch(`/api/giai/${slug}/truc-tiep`).catch(() => null);
      if (res?.ok) {
        setData(await res.json());
        setUpdated(new Date());
      }
    }, 5000);
    return () => clearInterval(t);
  }, [slug]);

  const all = data.categories.flatMap((c) => c.matches.map((m) => ({ m, c })));
  const live = all.filter(({ m }) => m.status === 'in_progress' || m.status === 'on_table').sort((a, b) => (a.m.status === 'in_progress' ? -1 : 1) - (b.m.status === 'in_progress' ? -1 : 1));
  const cat = data.categories.find((c) => c.id === sel);
  const champions = data.categories.filter((c) => c.results.length).map((c) => ({ c, gold: c.results.find((r) => r.place === 1) }));
  const n = (id: string | null) => (id ? data.entries[id]?.name ?? '—' : '…');

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col pb-10">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <Link href={`/${slug}`} className="flex min-w-0 flex-col">
          <span className="display truncate text-xl leading-none">{data.tournament.name}</span>
          <span className="text-xs text-muted">{updated ? `Cập nhật ${updated.toLocaleTimeString('vi-VN')}` : 'Tự cập nhật mỗi 5 giây'}</span>
        </Link>
        <span className="display flex items-center gap-1.5 bg-brand px-2.5 py-1 text-sm text-white"><span className="size-2 rounded-full bg-white" />Trực tiếp</span>
      </header>

      <section className="flex flex-col gap-2.5 px-4 pt-5">
        <h2 className="display text-2xl text-brand-text">Đang đấu</h2>
        {live.length === 0 && <p className="text-sm text-muted">Chưa có trận nào trên bàn.</p>}
        <div className="flex gap-2.5 overflow-x-auto pb-1">
          {live.map(({ m, c }) => (
            <div key={m.id} className={cx('flex w-64 shrink-0 flex-col gap-2 border bg-surface p-3', m.status === 'in_progress' ? 'border-brand' : 'border-line')}>
              <div className="flex justify-between text-xs">
                <span className="display text-base">{data.tables.find((t) => t.id === m.tableId)?.name ?? ''}</span>
                <span className="text-muted">{HAND_SHORT[c.hand]} {c.label} · T{m.number}</span>
              </div>
              <div className="flex items-center gap-2"><span className="h-5 w-1 bg-corner-red" /><strong className="truncate">{n(m.red)}</strong></div>
              <div className="flex items-center gap-2"><span className="h-5 w-1 bg-corner-blue" /><strong className="truncate">{n(m.blue)}</strong></div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3 px-4 pt-7">
        <h2 className="display text-2xl text-brand-text">Bảng đấu</h2>
        {data.categories.length === 0 ? (
          <p className="text-sm text-muted">BTC chưa xếp bảng.</p>
        ) : (
          <>
            <label className="flex flex-col gap-1.5 text-sm text-fg-2">
              Hạng mục
              <select value={sel} onChange={(e) => setSel(e.target.value)} className="min-h-12 border border-line-strong bg-surface px-2.5 font-semibold text-fg">
                {data.categories.map((c) => <option key={c.id} value={c.id}>{HAND_LABEL[c.hand]} · {c.gender === 'female' ? 'Nữ' : c.gender === 'male' ? 'Nam' : 'Mở'} {c.label}</option>)}
              </select>
            </label>
            {cat && <BracketView category={cat} entries={data.entries} tables={data.tables} />}
          </>
        )}
      </section>

      {champions.length > 0 && (
        <section className="flex flex-col gap-3 px-4 pt-7">
          <h2 className="display text-2xl text-brand-text">Kết quả</h2>
          {champions.map(({ c, gold }) => (
            <div key={c.id} className="flex flex-col gap-1 bg-brand p-4 text-white">
              <span className="text-xs uppercase tracking-[0.2em]">Vô địch {HAND_LABEL[c.hand].toLowerCase()} {c.label}</span>
              <span className="display text-3xl leading-none">{gold ? n(gold.entryId) : ''}</span>
              <span className="text-sm">{c.results.filter((r) => r.place > 1 && r.place <= 3).map((r) => `${['', '', 'Nhì', 'Ba'][r.place]}: ${n(r.entryId)}`).join(' · ')}</span>
              <a href={`/api/giai/${slug}/anh-ket-qua/${c.id}`} className="mt-1 self-start text-sm font-bold underline">Tải ảnh chia sẻ</a>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
