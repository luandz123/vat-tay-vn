'use client';

import { useRef, useState, useTransition } from 'react';
import type { ActionResult } from '@/app/_lib/action-result';
import {
  cancelRegistrationAction,
  editRegistrationAction,
  recordPaymentAction,
  setStatusAction,
} from '@/app/btc/manage-actions';
import { Alert, Button, Field, inputClass } from '@/components/ui';
import { formatVnd } from '@/server/shared/time';

export interface Row {
  id: string;
  code: string;
  name: string;
  phone: string;
  phoneRaw: string;
  club: string | null;
  birthYear: number;
  ageWarning: boolean;
  categories: string;
  amountDue: number;
  amountPaid: number;
  paymentStatus: string;
  status: string;
  source: string;
  checkedIn: boolean;
  note: string | null;
  ticketToken: string;
}

const PAY: Record<string, [string, string]> = {
  paid: ['Đã đóng', 'bg-[#14361f] text-success-text'],
  partial: ['Đóng thiếu', 'bg-[#3a2a0b] text-[#f7c948]'],
  unpaid: ['Chưa đóng', 'bg-[#3a2a0b] text-[#f7c948]'],
  refunded: ['Đã hoàn', 'bg-surface-2 text-fg-2'],
};
const STATUS: Record<string, string> = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối', cancelled: 'Đã hủy' };

export function RegistrationTable({ tournamentId, rows }: { tournamentId: string; rows: Row[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState<Row>();
  const [paying, setPaying] = useState<Row>();

  const act = (fn: () => Promise<ActionResult<unknown>>) =>
    start(async () => {
      const r = await fn();
      setError(r.ok ? undefined : r.error);
    });

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert tone="error">{error}</Alert>}
      <div className="overflow-x-auto border border-line bg-surface">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line-strong text-left text-xs uppercase tracking-wider text-muted">
              <th className="p-3">Mã</th>
              <th className="p-3">Vận động viên</th>
              <th className="p-3">Năm sinh</th>
              <th className="p-3">Hạng mục</th>
              <th className="p-3">Lệ phí</th>
              <th className="p-3">Trạng thái</th>
              <th className="p-3"><span className="sr-only">Thao tác</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-fg-2">Chưa có đăng ký nào.</td></tr>
            )}
            {rows.map((r) => {
              const [payLabel, payCls] = PAY[r.paymentStatus]!;
              return (
                <tr key={r.id} className="border-b border-line align-top">
                  <td className="p-3 text-muted">
                    {r.code}
                    {r.source === 'onsite' && <div className="text-xs">tại sân</div>}
                  </td>
                  <td className="p-3">
                    <div className="font-semibold">{r.name}</div>
                    <div className="text-xs text-muted">
                      <a href={`tel:${r.phoneRaw}`} className="hover:text-fg">{r.phone}</a>
                      {r.club && ` · ${r.club}`}
                    </div>
                    {r.note && <div className="text-xs text-fg-2">Ghi chú: {r.note}</div>}
                  </td>
                  <td className="p-3">
                    <span className={r.ageWarning ? 'text-gold' : ''}>{r.birthYear}</span>
                    {r.ageWarning && <div className="text-xs text-gold">ngoài giới hạn</div>}
                  </td>
                  <td className="p-3">{r.categories || '—'}</td>
                  <td className="p-3">
                    <div>{r.amountDue === 0 ? 'Miễn phí' : formatVnd(r.amountDue)}</div>
                    {r.amountDue > 0 && <span className={`mt-1 inline-block px-2 py-0.5 text-xs font-bold ${payCls}`}>{payLabel}{r.paymentStatus === 'partial' && ` ${formatVnd(r.amountPaid)}`}</span>}
                  </td>
                  <td className="p-3">
                    <div className={r.status === 'pending' ? 'text-gold' : 'text-fg-2'}>{STATUS[r.status]}</div>
                    {r.checkedIn && <div className="text-xs text-success-text">Đã check-in</div>}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {r.status === 'pending' && (
                        <Button variant="secondary" className="min-h-9 text-sm" disabled={pending} onClick={() => act(() => setStatusAction(tournamentId, r.id, 'approved'))}>Duyệt</Button>
                      )}
                      {r.amountPaid < r.amountDue && (
                        <Button className="min-h-9 text-sm" disabled={pending} onClick={() => setPaying(r)}>Thu tiền</Button>
                      )}
                      <Button className="min-h-9 text-sm" disabled={pending} onClick={() => setEditing(r)}>Sửa</Button>
                      <a className="flex min-h-9 items-center border border-line-strong px-3 text-sm font-semibold" href={`/ve/${r.ticketToken}`} target="_blank" rel="noreferrer">Vé</a>
                      <Button
                        className="min-h-9 text-sm"
                        disabled={pending}
                        onClick={() => {
                          if (confirm(`Hủy đăng ký của ${r.name}? Tiền đã thu (nếu có) BTC tự hoàn.`)) act(() => cancelRegistrationAction(tournamentId, r.id));
                        }}
                      >
                        Hủy
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {editing && <EditDialog tournamentId={tournamentId} row={editing} onClose={() => setEditing(undefined)} />}
      {paying && <PayDialog tournamentId={tournamentId} row={paying} onClose={() => setPaying(undefined)} />}
    </div>
  );
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <dialog
      ref={(el) => {
        ref.current = el;
        if (el && !el.open) el.showModal();
      }}
      onClose={onClose}
      className="m-auto w-[min(32rem,calc(100%-2rem))] border border-line-strong bg-surface p-5 text-fg backdrop:bg-black/70"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="display text-2xl">{title}</h2>
          <button type="button" aria-label="Đóng" onClick={() => ref.current?.close()} className="size-10 text-xl text-fg-2">✕</button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

function PayDialog({ tournamentId, row, onClose }: { tournamentId: string; row: Row; onClose: () => void }) {
  const [amount, setAmount] = useState(String(row.amountDue - row.amountPaid));
  const [method, setMethod] = useState<'cash' | 'manual'>('cash');
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <Dialog title={`Thu tiền · ${row.name}`} onClose={onClose}>
      <p className="text-sm text-fg-2">Phải thu {formatVnd(row.amountDue)}, đã thu {formatVnd(row.amountPaid)}.</p>
      <Field label="Số tiền">
        <input className={inputClass} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <div role="radiogroup" className="flex gap-2">
        {(['cash', 'manual'] as const).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={method === m} onClick={() => setMethod(m)} className={`min-h-11 flex-1 border border-line-strong font-semibold ${method === m ? 'bg-fg text-bg' : ''}`}>
            {m === 'cash' ? 'Tiền mặt' : 'Đã nhận chuyển khoản'}
          </button>
        ))}
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      <Button
        variant="primary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await recordPaymentAction(tournamentId, row.id, { amount: amount.replace(/\D/g, ''), method });
            if (r.ok) onClose();
            else setError(r.fields?.amount ?? r.error);
          })
        }
      >
        {pending ? 'Đang lưu…' : 'Xác nhận đã thu'}
      </Button>
    </Dialog>
  );
}

function EditDialog({ tournamentId, row, onClose }: { tournamentId: string; row: Row; onClose: () => void }) {
  const [v, setV] = useState({ fullName: row.name, phone: row.phone, birthYear: String(row.birthYear), club: row.club ?? '', note: row.note ?? '' });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  return (
    <Dialog title={`Sửa · ${row.code}`} onClose={onClose}>
      <Field label="Họ tên" error={fields.fullName}><input className={inputClass} value={v.fullName} onChange={set('fullName')} /></Field>
      <Field label="SĐT" error={fields.phone}><input className={inputClass} value={v.phone} onChange={set('phone')} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Năm sinh" error={fields.birthYear}><input className={inputClass} value={v.birthYear} onChange={set('birthYear')} /></Field>
        <Field label="CLB"><input className={inputClass} value={v.club} onChange={set('club')} /></Field>
      </div>
      <Field label="Ghi chú của BTC"><input className={inputClass} value={v.note} onChange={set('note')} /></Field>
      <p className="text-xs text-muted">Đổi hạng mục: dùng “Chuyển hạng” ở màn Check-in & cân.</p>
      {error && <Alert tone="error">{error}</Alert>}
      <Button
        variant="primary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await editRegistrationAction(tournamentId, row.id, v);
            if (r.ok) onClose();
            else {
              setError(r.error);
              setFields(r.fields ?? {});
            }
          })
        }
      >
        {pending ? 'Đang lưu…' : 'Lưu'}
      </Button>
    </Dialog>
  );
}
