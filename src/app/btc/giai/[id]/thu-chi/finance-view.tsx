'use client';

import { useState, useTransition } from 'react';
import { addExpenseAction, deleteExpenseAction, setFinanceVisibilityAction } from '@/app/btc/manage-actions';
import { Alert, Button, Card, Field, inputClass } from '@/components/ui';
import { formatVnd } from '@/server/shared/time';

const VIS = [
  { v: 'off', label: 'Tắt', desc: 'Không dùng báo cáo thu chi' },
  { v: 'organizers', label: 'Chỉ BTC', desc: 'Chỉ thành viên BTC xem' },
  { v: 'athletes', label: 'VĐV đã đăng ký', desc: 'Hiện trên trang vé của VĐV' },
  { v: 'public', label: 'Công khai', desc: 'Hiện trên trang giải' },
];
const METHOD: Record<string, string> = { vietqr: 'Chuyển khoản VietQR', cash: 'Tiền mặt', manual: 'Xác nhận tay' };

export function FinanceView({
  tournamentId,
  data,
}: {
  tournamentId: string;
  data: { visibility: string; income: { method: string; total: number; count: number }[]; expenses: { id: string; title: string; amount: number }[]; totalIncome: number; totalExpense: number; balance: number };
}) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { const r = await fn(); setError(r.ok ? undefined : r.error); });

  return (
    <div className="flex flex-col gap-5">
      <Card title="Ai được xem?">
        <div className="grid gap-2 sm:grid-cols-4">
          {VIS.map((x) => (
            <button
              key={x.v}
              type="button"
              aria-pressed={data.visibility === x.v}
              disabled={pending}
              onClick={() => run(() => setFinanceVisibilityAction(tournamentId, x.v))}
              className={`flex flex-col items-start gap-1 border p-3 text-left ${data.visibility === x.v ? 'border-brand bg-surface-2' : 'border-line-strong'}`}
            >
              <strong>{x.label}</strong>
              <span className="text-xs text-muted">{x.desc}</span>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        {[['Tổng thu', data.totalIncome], ['Tổng chi', data.totalExpense], ['Còn lại', data.balance]].map(([l, v]) => (
          <div key={l as string} className="flex flex-col gap-1 border border-line bg-surface p-4">
            <span className="text-xs uppercase tracking-wider text-muted">{l}</span>
            <span className={`font-display text-3xl font-bold ${(v as number) < 0 ? 'text-brand-text' : ''}`}>{formatVnd(v as number)}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Thu">
          {data.income.length === 0 && <p className="text-sm text-fg-2">Chưa có khoản thu nào.</p>}
          {data.income.map((i) => (
            <div key={i.method} className="flex justify-between border-b border-line pb-2 text-sm last:border-b-0">
              <span>{METHOD[i.method] ?? i.method} ({i.count})</span>
              <strong>{formatVnd(i.total)}</strong>
            </div>
          ))}
        </Card>
        <Card title="Chi">
          {data.expenses.map((e) => (
            <div key={e.id} className="flex items-center gap-2 border-b border-line pb-2 text-sm last:border-b-0">
              <span className="flex-1">{e.title}</span>
              <strong>{formatVnd(e.amount)}</strong>
              <button type="button" aria-label={`Xóa ${e.title}`} onClick={() => run(() => deleteExpenseAction(tournamentId, e.id))} className="size-9 border border-line-strong text-fg-2">✕</button>
            </div>
          ))}
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(ev) => {
              ev.preventDefault();
              run(async () => {
                const r = await addExpenseAction(tournamentId, { title, amount });
                if (r.ok) { setTitle(''); setAmount(''); }
                return r;
              });
            }}
          >
            <Field label="Nội dung" className="flex-1"><input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Thuê bàn, huy chương…" /></Field>
            <Field label="Số tiền"><input className={`${inputClass} w-36`} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" /></Field>
            <Button type="submit" disabled={pending}>Thêm</Button>
          </form>
        </Card>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}
