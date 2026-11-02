import type { Metadata } from 'next';
import { Card } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { emailEnabled, listNotifications } from '@/server/notifications/service';
import { formatDateTime, toVnLocal } from '@/server/shared/time';
import { requireTournament } from '@/server/tournaments/service';
import { NotifyForms } from './notify-forms';

export const metadata: Metadata = { title: 'Thông báo & dời lịch' };

export default async function NotifyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const [t, history] = await Promise.all([requireTournament(user.id, id), listNotifications(user.id, id)]);
  return (
    <main className="flex flex-col gap-5 p-4 sm:p-6">
      <h1 className="display text-3xl">Thông báo &amp; dời lịch</h1>
      <NotifyForms tournamentId={id} currentStart={toVnLocal(t.startsAt)} emailOn={emailEnabled()} />
      <Card title="Đã gửi">
        {history.length === 0 && <p className="text-sm text-fg-2">Chưa có thông báo nào.</p>}
        {history.map((n) => (
          <div key={n.id} className="flex flex-col gap-1 border-b border-line pb-3 last:border-b-0">
            <div className="flex flex-wrap items-baseline gap-2">
              <strong>{n.title}</strong>
              <span className="text-xs text-muted">
                {formatDateTime(n.createdAt)} · {n.kind === 'postpone' ? 'Dời lịch' : 'Thông báo'}
                {n.recipientsCount > 0 && ` · ${n.recipientsCount} email`}
              </span>
            </div>
            <p className="whitespace-pre-line text-sm text-fg-2">{n.body}</p>
          </div>
        ))}
      </Card>
    </main>
  );
}
