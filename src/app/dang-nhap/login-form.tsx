'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Alert, Button, Field, cx, inputClass } from '@/components/ui';
import { passwordAuth, requestMagicLink } from './actions';

type Mode = 'signin' | 'signup' | 'link';

export function LoginForm({ next, initialMode = 'signin' }: { next: string; initialMode?: Mode }) {
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
