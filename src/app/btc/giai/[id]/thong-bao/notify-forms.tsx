'use client';

import { useState, useTransition } from 'react';
import { broadcastAction, postponeAction } from '@/app/btc/manage-actions';
import { Alert, Button, Card, Field, inputClass } from '@/components/ui';

function ZaloText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2 border border-success p-3">
      <p className="text-sm text-success-text">Đã đăng banner trên trang giải và trang vé. Copy nội dung dưới đây dán vào nhóm Zalo/Facebook của giải:</p>
      <pre className="whitespace-pre-wrap bg-bg p-3 font-sans text-sm text-fg-2">{text}</pre>
      <Button onClick={async () => { await navigator.clipboard.writeText(text).catch(() => undefined); setCopied(true); }}>
        {copied ? 'Đã copy!' : 'Copy nội dung'}
      </Button>
    </div>
  );
}

export function NotifyForms({ tournamentId, currentStart, emailOn }: { tournamentId: string; currentStart: string; emailOn: boolean }) {
  const [startsAt, setStartsAt] = useState(currentStart);
  const [reason, setReason] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [result, setResult] = useState<{ which: 'postpone' | 'broadcast'; zaloText: string; emailed: number }>();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const emailNote = emailOn ? 'Gửi email cho VĐV có để lại email.' : 'Email chưa được cấu hình (RESEND_API_KEY) — chỉ đăng banner và tạo văn bản Zalo.';

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card title="Dời lịch giải">
        <p className="text-sm text-fg-2">Hạn đăng ký và giờ kết thúc tự dời theo. {emailNote}</p>
        <Field label="Thời gian mới">
          <input type="datetime-local" className={inputClass} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </Field>
        <Field label="Lý do / lời nhắn (không bắt buộc)">
          <textarea className={`${inputClass} min-h-20 py-2`} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <Button
          variant="primary"
          disabled={pending || !startsAt || startsAt === currentStart}
          onClick={() =>
            start(async () => {
              if (!confirm('Dời lịch và thông báo cho mọi VĐV đã đăng ký?')) return;
              const r = await postponeAction(tournamentId, { startsAt, message: reason, email: true });
              if (r.ok) setResult({ which: 'postpone', ...r.data });
              else setError(r.error);
            })
          }
        >
          Dời lịch &amp; thông báo
        </Button>
        {result?.which === 'postpone' && <ZaloText text={result.zaloText} />}
      </Card>

      <Card title="Gửi thông báo hàng loạt">
        <p className="text-sm text-fg-2">{emailNote}</p>
        <Field label="Tiêu đề">
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lịch cân sáng chủ nhật" />
        </Field>
        <Field label="Nội dung">
          <textarea className={`${inputClass} min-h-28 py-2`} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <Button
          variant="primary"
          disabled={pending || title.length < 3 || body.length < 3}
          onClick={() =>
            start(async () => {
              const r = await broadcastAction(tournamentId, { title, body, email: true });
              if (r.ok) {
                setResult({ which: 'broadcast', ...r.data });
                setTitle('');
                setBody('');
              } else setError(r.error);
            })
          }
        >
          Gửi thông báo
        </Button>
        {result?.which === 'broadcast' && <ZaloText text={result.zaloText} />}
      </Card>
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}
