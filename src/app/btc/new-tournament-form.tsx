'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button, Field, inputClass } from '@/components/ui';
import { createDraftAction } from './actions';

export function NewTournamentForm({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await createDraftAction({ organizationId, name });
          if (r.ok) router.push(`/btc/giai/${r.data.id}/thong-tin`);
          else setError(r.fields?.name ?? r.error);
        });
      }}
    >
      <Field label="Tên giải" error={error} className="min-w-64 flex-1">
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Giải vật tay PTIT mở rộng 2026"
          required
        />
      </Field>
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? 'Đang tạo…' : 'Bắt đầu →'}
      </Button>
    </form>
  );
}
