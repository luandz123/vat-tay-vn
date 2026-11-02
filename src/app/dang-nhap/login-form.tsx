'use client';

import { useState, useTransition } from 'react';
import { Alert, Button, Field, inputClass } from '@/components/ui';
import { requestMagicLink } from './actions';

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  if (sent)
    return (
      <Alert tone="success">
        Đã gửi link đăng nhập tới <strong>{email}</strong>. Mở email và bấm link để vào khu BTC (kiểm tra cả mục Spam).
      </Alert>
    );

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await requestMagicLink({ email, next });
          if (r.ok) setSent(true);
          else setError(r.fields?.email ?? r.error);
        });
      }}
    >
      <Field label="Email của bạn" error={error}>
        <input
          className={inputClass}
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ban@vidu.com"
        />
      </Field>
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? 'Đang gửi…' : 'Gửi link đăng nhập'}
      </Button>
      <p className="text-xs text-muted">Không cần mật khẩu. Đăng nhập bằng Google sẽ có sau.</p>
    </form>
  );
}
