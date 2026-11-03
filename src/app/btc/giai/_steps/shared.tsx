'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { ActionResult } from '@/app/_lib/action-result';
import { Alert, Button } from '@/components/ui';

import type { StepSlug } from './steps';

export { STEPS, type StepSlug } from './steps';

let seq = 0;
/** Khóa tạm cho dòng mới (chưa lưu) trong danh sách. */
export const tempKey = () => `new-${Date.now().toString(36)}-${++seq}`;

/** Gọi action lưu, hiển thị lỗi, chuyển bước khi thành công. */
export function useSaver(tournamentId: string) {
  const router = useRouter();
  const pathname = usePathname();
  // Sau khi lưu, bước có danh sách được dựng lại (id mới) nên giữ mốc "đã lưu" trên URL
  const savedParam = useSearchParams().get('da-luu');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState<Date>();

  function save(run: () => Promise<ActionResult<unknown>>, next?: StepSlug) {
    start(async () => {
      const r = await run();
      if (!r.ok) {
        setError(r.error);
        setFields(r.fields ?? {});
        return;
      }
      setError(undefined);
      setFields({});
      setSavedAt(new Date());
      if (next) router.push(`/btc/giai/${tournamentId}/${next}`);
      else router.replace(`${pathname}?da-luu=${Date.now()}`, { scroll: false });
    });
  }
  return { pending, error, fields, savedAt: savedAt ?? (savedParam ? new Date(Number(savedParam)) : undefined), save };
}

export function StepFooter({
  tournamentId,
  prev,
  next,
  nextLabel,
  pending,
  error,
  savedAt,
  onSave,
}: {
  tournamentId: string;
  prev?: StepSlug;
  next?: StepSlug;
  nextLabel?: string;
  pending: boolean;
  error?: string;
  savedAt?: Date;
  onSave: (next?: StepSlug) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex flex-wrap items-center gap-2">
        {prev && (
          <a href={`/btc/giai/${tournamentId}/${prev}`} className="min-h-11 border border-line-strong px-4 py-2.5 font-semibold hover:bg-surface-2">
            ← Quay lại
          </a>
        )}
        <span className="ml-auto text-sm text-muted" aria-live="polite">
          {pending ? 'Đang lưu…' : savedAt ? `Đã lưu lúc ${savedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : ''}
        </span>
        <Button disabled={pending} onClick={() => onSave()}>
          Lưu nháp
        </Button>
        {next && (
          <Button variant="primary" disabled={pending} onClick={() => onSave(next)}>
            {nextLabel ?? 'Tiếp →'}
          </Button>
        )}
      </div>
    </div>
  );
}
