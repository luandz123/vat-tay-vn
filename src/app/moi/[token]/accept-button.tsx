'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Alert, Button } from '@/components/ui';
import { acceptInviteAction } from '../actions';

export function AcceptButton({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="primary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await acceptInviteAction(token);
            if (r.ok) router.push(`/btc?btc=${r.data.organizationId}`);
            else setError(r.error);
          })
        }
      >
        {pending ? 'Đang tham gia…' : 'Tham gia Ban tổ chức'}
      </Button>
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}
