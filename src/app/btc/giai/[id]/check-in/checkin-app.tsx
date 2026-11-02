'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState, useTransition } from 'react';
import { checkinDetailAction, confirmWeighInAction, findTicketAction, moveEntryAction } from '@/app/btc/manage-actions';
import { Alert, Button, cx } from '@/components/ui';
import type { CheckinDetail } from '@/server/checkin/service';
import { evaluateWeigh, parseKg } from '@/server/checkin/weigh';
import { normalizeName } from '@/server/registration/rules';
import { formatVnd } from '@/server/shared/time';
import { HAND_LABEL } from '@/server/tournaments/templates';
import { QrScanner } from './qr-scanner';

interface Person {
  id: string;
  code: string;
  name: string;
  phone: string;
  cats: string;
  weighed: boolean;
  paid: boolean;
}

export function CheckinApp({ tournamentId, people }: { tournamentId: string; people: Person[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [scan, setScan] = useState(false);
  const [detail, setDetail] = useState<CheckinDetail>();
  const [kg, setKg] = useState('');
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string }>();
  const [pending, start] = useTransition();

  const list = useMemo(() => {
    const n = normalizeName(q);
    const digits = q.replace(/\D/g, '');
    return people
      .filter((p) => !q || normalizeName(p.name).includes(n) || p.code.toLowerCase().includes(q.toLowerCase()) || (digits.length >= 3 && p.phone.replace(/\D/g, '').includes(digits)))
      .sort((a, b) => Number(a.weighed) - Number(b.weighed));
  }, [people, q]);
  const weighedCount = people.filter((p) => p.weighed).length;

  const open = useCallback(
    (id: string) =>
      start(async () => {
        setMsg(undefined);
        const r = await checkinDetailAction(tournamentId, id);
        if (r.ok) {
          setDetail(r.data);
          setKg(r.data.registration.weighedKg?.toString() ?? '');
        } else setMsg({ tone: 'error', text: r.error });
      }),
    [tournamentId],
  );

  const onScan = useCallback(
    (text: string) => {
      setScan(false);
      start(async () => {
        const r = await findTicketAction(tournamentId, text);
        if (r.ok && r.data) open(r.data);
        else setMsg({ tone: 'error', text: 'Vé không thuộc giải này' });
      });
    },
    [tournamentId, open],
  );

  const weight = parseKg(kg);
  const verdicts = detail && weight !== null ? detail.entries.map((e) => ({ e, v: evaluateWeigh(weight, e.category, detail.classes, detail.tournament.toleranceKg) })) : [];
  const nudge = (d: number) => setKg(((weight ?? 0) + d).toFixed(1));
  const r = detail?.registration;
  const y = detail?.athlete.birthYear;
  const ageWarn = !!r?.ageWarning;

  return (
    <main className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="display text-3xl">Check-in &amp; cân</h1>
        <span className="ml-auto text-sm text-fg-2">
          Đã cân <strong className="text-fg">{weighedCount}</strong> / {people.length}
        </span>
        <div className="h-2 w-40 bg-line" aria-hidden="true">
          <div className="h-2 bg-brand" style={{ width: `${people.length ? (weighedCount / people.length) * 100 : 0}%` }} />
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <section className="flex w-full flex-col gap-3 lg:w-96">
          {scan ? (
            <QrScanner onResult={onScan} onClose={() => setScan(false)} />
          ) : (
            <button type="button" onClick={() => setScan(true)} className="display btn-slant flex min-h-16 items-center justify-center gap-2.5 bg-brand text-xl text-white">
              Quét vé QR
            </button>
          )}
          <label className="sr-only" htmlFor="tim">Tìm VĐV</label>
          <input id="tim" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Hoặc tìm tên / SĐT / mã vé" className="min-h-12 border border-line-strong bg-surface px-3" />
          <div className="flex max-h-[60vh] flex-col overflow-y-auto border border-line">
            {list.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => open(p.id)}
                className={cx('flex items-center gap-3 border-b border-l-4 border-b-line px-3.5 py-3 text-left', detail?.registration.id === p.id ? 'border-l-brand bg-surface-2' : 'border-l-transparent bg-surface')}
              >
                <span className="flex flex-1 flex-col">
                  <strong>{p.name}</strong>
                  <span className="text-xs text-muted">{p.code} · {p.cats}</span>
                </span>
                <span className={cx('text-xs', p.weighed ? 'text-success-text' : p.paid ? 'text-muted' : 'text-[#f7c948]')}>
                  {p.weighed ? 'Đã cân' : p.paid ? 'Sẵn sàng' : 'Chưa đóng phí'}
                </span>
              </button>
            ))}
            {list.length === 0 && <p className="p-4 text-sm text-muted">Không tìm thấy.</p>}
          </div>
        </section>

        <section className="flex min-w-0 flex-[999_1_480px] flex-col gap-5 border border-line bg-surface p-5">
          {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
          {!detail ? (
            <p className="text-fg-2">Quét vé hoặc chọn một VĐV ở danh sách bên trái.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="display text-3xl leading-none">{detail.athlete.fullName}</span>
                  <span className="text-sm text-fg-2">
                    {r!.code} · {detail.athlete.gender === 'male' ? 'Nam' : 'Nữ'} · sinh {y} {detail.athlete.club && `· ${detail.athlete.club}`}
                  </span>
                </div>
                <div className="ml-auto flex flex-wrap gap-1.5">
                  <span className={cx('px-2.5 py-1 text-sm font-bold', r!.paymentStatus === 'paid' ? 'bg-[#14361f] text-success-text' : 'bg-[#3a2a0b] text-[#f7c948]')}>
                    {r!.paymentStatus === 'paid' ? 'Đã đóng' : `Còn thiếu ${formatVnd(r!.amountDue - r!.amountPaid)}`}
                  </span>
                  {ageWarn && <span className="bg-[#3a2a0b] px-2.5 py-1 text-sm font-bold text-[#f7c948]">Năm sinh ngoài giới hạn</span>}
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-4">
                <label className="flex flex-col gap-2 text-sm text-fg-2">
                  Cân nặng thực tế (kg)
                  <input
                    value={kg}
                    onChange={(e) => setKg(e.target.value)}
                    inputMode="decimal"
                    autoFocus
                    className="h-20 w-52 border-2 border-fg bg-bg px-4 font-display text-5xl font-bold text-fg"
                  />
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[-0.5, -0.1, 0.1, 0.5].map((d) => (
                    <button key={d} type="button" onClick={() => nudge(d)} className="min-h-12 min-w-16 border border-line-strong bg-surface-2 font-bold">
                      {d > 0 ? `+${d}` : d}
                    </button>
                  ))}
                </div>
                <span className="text-sm text-muted">Dung sai giải: +{detail.tournament.toleranceKg} kg</span>
              </div>

              <div className="flex flex-col gap-2.5">
                {detail.entries.map((e) => {
                  const v = verdicts.find((x) => x.e.id === e.id)?.v;
                  const ok = v?.pass;
                  return (
                    <div
                      key={e.id}
                      className={cx('flex flex-wrap items-center gap-3.5 border px-4 py-3.5', v === undefined ? 'border-line-strong' : ok ? 'border-[#1f5133] bg-[#0f2418]' : 'border-[#5c1f24] bg-[#2a1214]')}
                    >
                      <div className="flex flex-1 flex-col gap-0.5">
                        <strong>{HAND_LABEL[e.category.hand]} · {e.category.label}{e.movedFromEntryId && ' (đã chuyển)'}</strong>
                        <span className="text-sm text-fg-2">
                          {v === undefined
                            ? 'Nhập số cân để xem gợi ý'
                            : v.limitKg === null
                              ? 'Hạng không giới hạn trên'
                              : `Tối đa ${v.limitKg} kg (đã tính dung sai) · ${v.marginKg! >= 0 ? 'dư' : 'vượt'} ${Math.abs(v.marginKg!)} kg`}
                        </span>
                      </div>
                      {v && !v.pass && v.suggestion && (
                        <Button
                          variant="secondary"
                          className="bg-fg text-bg"
                          disabled={pending}
                          onClick={() =>
                            start(async () => {
                              const res = await moveEntryAction(tournamentId, e.id, v.suggestion!.id);
                              if (res.ok) open(detail.registration.id);
                              else setMsg({ tone: 'error', text: res.error });
                            })
                          }
                        >
                          Chuyển sang {v.suggestion.label}
                        </Button>
                      )}
                      {v && <span className={cx('display text-lg', ok ? 'text-success-text' : 'text-[#ff7a7f]')}>{ok ? 'Đạt' : 'Không đạt'}</span>}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
                <span className="text-sm text-muted">Hệ thống chỉ gợi ý. BTC quyết định cuối cùng.</span>
                <Button
                  variant="primary"
                  className="ml-auto"
                  disabled={pending || weight === null}
                  onClick={() =>
                    start(async () => {
                      const res = await confirmWeighInAction(tournamentId, detail.registration.id, kg);
                      if (res.ok) {
                        setMsg({ tone: 'success', text: `Đã check-in ${detail.athlete.fullName} · ${weight} kg` });
                        setDetail(undefined);
                        setKg('');
                        router.refresh();
                      } else setMsg({ tone: 'error', text: res.error });
                    })
                  }
                >
                  Xác nhận cân &amp; check-in
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
