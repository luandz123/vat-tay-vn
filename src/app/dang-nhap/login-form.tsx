'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Alert, Button, Field, cx, inputClass } from '@/components/ui';
import { googleSignIn, passwordAuth, requestMagicLink } from './actions';

type Mode = 'signin' | 'signup' | 'link';

export function LoginForm({ next, initialMode = 'signin', google = false }: { next: string; initialMode?: Mode; google?: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  if (sent)
    return (
      <Alert tone="success">
        Đã gửi link đăng nhập tới <strong>{email}</strong>. Mở email và bấm link (kiểm tra cả mục Spam).
      </Alert>
    );

  const tabs: { key: Mode; label: string }[] = [
    { key: 'signin', label: 'Đăng nhập' },
    { key: 'signup', label: 'Tạo tài khoản' },
    { key: 'link', label: 'Link qua email' },
  ];

  return (
    <div className="flex flex-col gap-5">
      {google && (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await googleSignIn(next);
                if (r.ok) window.location.assign(r.data.url);
                else setError(r.error);
              })
            }
            className="flex min-h-12 items-center justify-center gap-3 border border-line-strong bg-fg font-semibold text-bg hover:brightness-95 disabled:opacity-50"
          >
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z" />
            </svg>
            Tiếp tục với Google
          </button>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-line-strong" />
            hoặc dùng email
            <span className="h-px flex-1 bg-line-strong" />
          </div>
        </>
      )}
      <div role="tablist" className="grid grid-cols-3 border border-line-strong">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={mode === t.key}
            onClick={() => {
              setMode(t.key);
              setError(undefined);
              setFields({});
            }}
            className={cx('min-h-11 text-sm font-semibold', mode === t.key ? 'bg-fg text-bg' : 'text-fg-2')}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(undefined);
          start(async () => {
            if (mode === 'link') {
              const r = await requestMagicLink({ email, next });
              if (r.ok) setSent(true);
              else setError(r.fields?.email ?? r.error);
              return;
            }
            const r = await passwordAuth({ email, password, fullName, mode });
            if (r.ok) {
              router.push(next);
              router.refresh();
            } else {
              setError(r.error);
              setFields(r.fields ?? {});
            }
          });
        }}
      >
        {mode === 'signup' && (
          <Field label="Họ và tên" error={fields.fullName}>
            <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required />
          </Field>
        )}
        <Field label="Email" error={fields.email}>
          <input className={inputClass} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ban@vidu.com" />
        </Field>
        {mode !== 'link' && (
          <Field label="Mật khẩu" error={fields.password} hint={mode === 'signup' ? 'Tối thiểu 6 ký tự' : undefined}>
            <input
              className={inputClass}
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        )}
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Đang xử lý…' : mode === 'signin' ? 'Đăng nhập' : mode === 'signup' ? 'Tạo tài khoản' : 'Gửi link đăng nhập'}
        </Button>
        {mode === 'link' && <p className="text-xs text-muted">Không cần mật khẩu. Mỗi giờ hệ thống chỉ gửi được vài email.</p>}
      </form>
    </div>
  );
}
