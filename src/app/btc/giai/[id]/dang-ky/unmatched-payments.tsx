'use client';

import { useState, useTransition } from 'react';
import { ignorePaymentAction, matchPaymentAction } from '@/app/btc/manage-actions';
import { Alert, Button, Card, inputClass } from '@/components/ui';
import { formatDateTime, formatVnd } from '@/server/shared/time';

export function UnmatchedPayments({
  tournamentId,
  payments,
  registrations,
}: {
  tournamentId: string;
  payments: { id: string; amount: number; content: string; receivedAt: string }[];
  registrations: { id: string; label: string }[];
}) {
  const [pick, setPick] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <Card title={`${payments.length} giao dịch chưa ghép được`}>
      <p className="text-sm text-fg-2">Chuyển khoản có nội dung không khớp mã đăng ký. Chọn đúng VĐV để ghép, hoặc bỏ qua nếu không liên quan.</p>
      {payments.map((p) => (
        <div key={p.id} className="flex flex-wrap items-center gap-3 border border-line-strong p-3">
          <div className="flex min-w-48 flex-1 flex-col">
            <span className="font-bold">{formatVnd(p.amount)}</span>
            <span className="text-xs text-muted">{formatDateTime(new Date(p.receivedAt))} · “{p.content}”</span>
          </div>
          <select aria-label="Ghép vào đăng ký" className={`${inputClass} w-72`} value={pick[p.id] ?? ''} onChange={(e) => setPick({ ...pick, [p.id]: e.target.value })}>
            <option value="">— Chọn VĐV —</option>
            {registrations.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <Button variant="secondary" disabled={pending || !pick[p.id]} onClick={() => start(async () => { const r = await matchPaymentAction(tournamentId, p.id, pick[p.id]!); setError(r.ok ? undefined : r.error); })}>Ghép</Button>
          <Button disabled={pending} onClick={() => start(async () => { const r = await ignorePaymentAction(tournamentId, p.id); setError(r.ok ? undefined : r.error); })}>Bỏ qua</Button>
        </div>
      ))}
      {error && <Alert tone="error">{error}</Alert>}
    </Card>
  );
}
