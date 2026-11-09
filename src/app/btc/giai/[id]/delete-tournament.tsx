'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deleteTournamentAction } from '@/app/btc/actions';
import { Alert, Button, Card, Field, inputClass } from '@/components/ui';
import { formatVnd } from '@/server/shared/time';

export function DeleteTournament({ id, impact }: { id: string; impact: { slug: string; name: string; registrations: number; paid: number } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmSlug, setConfirmSlug] = useState('');
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <Card title="Xóa giải" className="border-[#5c1f24]">
      {!open ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex-1 text-sm text-fg-2">Xóa hẳn giải này cùng mọi dữ liệu. Không hoàn tác được.</p>
          <Button onClick={() => setOpen(true)} className="border-[#5c1f24] text-[#ff7a7f]">Xóa giải…</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Alert tone="error">
            Sẽ xóa vĩnh viễn <strong>{impact.name}</strong>: hạng mục, {impact.registrations} lượt đăng ký, bảng đấu, kết quả, thông báo và báo cáo thu chi.
            {impact.paid > 0 && (
              <>
                {' '}Giải đã ghi nhận <strong>{formatVnd(impact.paid)}</strong> tiền thu — lịch sử này cũng bị xóa (tiền thật vẫn nằm trong tài khoản BTC, hãy tự hoàn cho VĐV nếu cần).
              </>
            )}
          </Alert>
          <Field label={`Gõ link trang giải "${impact.slug}" để xác nhận`}>
            <input className={inputClass} value={confirmSlug} onChange={(e) => setConfirmSlug(e.target.value)} autoComplete="off" />
          </Field>
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex gap-2">
            <Button onClick={() => setOpen(false)}>Hủy</Button>
            <Button
              className="border-[#d9262e] bg-[#d9262e] text-white"
              disabled={pending || confirmSlug.trim() !== impact.slug}
              onClick={() =>
                start(async () => {
                  const r = await deleteTournamentAction(id, confirmSlug);
                  if (r.ok) router.push('/btc');
                  else setError(r.error);
                })
              }
            >
              {pending ? 'Đang xóa…' : 'Xóa vĩnh viễn'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
