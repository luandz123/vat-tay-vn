'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createInviteAction, removeMemberAction, revokeInviteAction } from '@/app/btc/actions';
import { Alert, Button, Card, Field, inputClass } from '@/components/ui';

export function MemberActions({ orgId, memberUserId, self, name }: { orgId: string; memberUserId: string; self: boolean; name: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        className="min-h-9 text-sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            if (!confirm(self ? 'Rời Ban tổ chức này?' : `Gỡ ${name} khỏi Ban tổ chức?`)) return;
            const r = await removeMemberAction(orgId, memberUserId);
            if (!r.ok) setError(r.error);
            else if (self) router.push('/btc');
          })
        }
      >
        {self ? 'Rời BTC' : 'Gỡ'}
      </Button>
      {error && <span className="text-xs text-brand-text">{error}</span>}
    </div>
  );
}

export function InvitePanel({ orgId, invites }: { orgId: string; invites: { id: string; note: string | null; role: string; expiresAt: string }[] }) {
  const [note, setNote] = useState('');
  const [role, setRole] = useState<'staff' | 'owner'>('staff');
  const [link, setLink] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <Card title="Mời thành viên">
      <p className="text-sm text-fg-2">
        Tạo link rồi gửi qua Zalo/Messenger. Người nhận mở link, tạo tài khoản (email + mật khẩu) là vào BTC. Mỗi link dùng một lần, hết hạn sau 7 ngày.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Ghi chú (để nhớ link gửi cho ai)" className="min-w-56 flex-1">
          <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anh Quân – bàn cân" />
        </Field>
        <Field label="Vai trò">
          <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value as 'staff' | 'owner')}>
            <option value="staff">Thành viên</option>
            <option value="owner">Đồng chủ BTC</option>
          </select>
        </Field>
        <Button
          variant="primary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await createInviteAction(orgId, { note, role });
              if (r.ok) {
                setLink(r.data.link);
                setCopied(false);
                setNote('');
              } else setError(r.error);
            })
          }
        >
          Tạo link mời
        </Button>
      </div>
      {link && (
        <div className="flex flex-col gap-2 border border-success p-3">
          <span className="text-sm text-success-text">Link mời (chỉ hiện một lần):</span>
          <code className="break-all font-bold">{link}</code>
          <Button
            className="self-start"
            onClick={async () => {
              await navigator.clipboard.writeText(link).catch(() => undefined);
              setCopied(true);
            }}
          >
            {copied ? 'Đã copy!' : 'Copy link'}
          </Button>
        </div>
      )}
      {invites.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-fg-2">Link đang chờ dùng</h3>
          {invites.map((i) => (
            <div key={i.id} className="flex items-center gap-3 bg-surface-2 px-3 py-2 text-sm">
              <span className="flex-1">{i.note || 'Không ghi chú'} · {i.role === 'owner' ? 'đồng chủ' : 'thành viên'} · hết hạn {i.expiresAt}</span>
              <button type="button" className="font-semibold text-brand-text" disabled={pending} onClick={() => start(async () => { await revokeInviteAction(orgId, i.id); })}>
                Thu hồi
              </button>
            </div>
          ))}
        </div>
      )}
      {error && <Alert tone="error">{error}</Alert>}
    </Card>
  );
}
