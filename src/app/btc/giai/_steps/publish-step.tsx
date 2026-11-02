'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { publishAction } from '@/app/btc/actions';
import { ShareTools } from '@/components/share-tools';
import { Alert, Button, Card, buttonClass } from '@/components/ui';
import type { ChecklistIssue } from '@/server/tournaments/checklist';
import { STEPS } from './shared';

export function PublishStep({
  tournamentId,
  status,
  url,
  issues,
  sharePost,
}: {
  tournamentId: string;
  status: string;
  url: string;
  issues: ChecklistIssue[];
  sharePost: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');
  const published = status !== 'draft';
  const slug = url.split('/').pop() ?? '';
  const stepTitle = (s: string) => STEPS.find((x) => x.slug === s)?.title ?? s;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="display text-4xl leading-none">
        {published ? (
          <>
            Giải đã <span className="text-brand-text">xuất bản</span>
          </>
        ) : (
          <>
            Kiểm tra <span className="text-brand-text">&amp; xuất bản</span>
          </>
        )}
      </h1>

      {!published && (
        <Card title="Kiểm tra trước khi xuất bản">
          {issues.length === 0 && <Alert tone="success">Mọi thông tin đã đầy đủ. Sẵn sàng mở đăng ký!</Alert>}
          {[...errors, ...warnings].map((i, n) => (
            <a key={n} href={`/btc/giai/${tournamentId}/${i.step}`} className="block">
              <Alert tone={i.level === 'error' ? 'error' : 'warning'}>
                <strong>{i.level === 'error' ? 'Bắt buộc' : 'Lưu ý'}:</strong> {i.message} <span className="underline">— sửa ở “{stepTitle(i.step)}”</span>
              </Alert>
            </a>
          ))}
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex flex-wrap items-center gap-3">
            <a href={`/btc/giai/${tournamentId}/lich-giai-thuong`} className={buttonClass('secondary')}>
              ← Quay lại
            </a>
            <Button
              variant="primary"
              className="ml-auto"
              disabled={pending || errors.length > 0}
              onClick={() =>
                start(async () => {
                  const r = await publishAction(tournamentId);
                  if (r.ok) router.refresh();
                  else setError(r.error);
                })
              }
            >
              {pending ? 'Đang xuất bản…' : warnings.length ? 'Vẫn xuất bản' : 'Xuất bản & mở đăng ký'}
            </Button>
          </div>
        </Card>
      )}

      {published && (
        <Card title="Chia sẻ giải">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xl font-bold">{url.replace(/^https?:\/\//, '')}</span>
            <a href={url} target="_blank" rel="noreferrer" className={buttonClass('ghost')}>
              Mở trang giải ↗
            </a>
          </div>
          <ShareTools url={url} title="" post={sharePost} slug={slug} />
          {sharePost && (
            <details className="text-sm">
              <summary className="cursor-pointer font-semibold text-fg-2">Xem bài đăng mẫu</summary>
              <pre className="mt-2 whitespace-pre-wrap bg-bg p-3 font-sans text-fg-2">{sharePost}</pre>
            </details>
          )}
        </Card>
      )}
    </div>
  );
}
