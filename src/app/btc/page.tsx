import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, buttonClass } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { listMyOrganizations } from '@/server/organizations/service';
import { formatDateTime } from '@/server/shared/time';
import { listOrganizationTournaments } from '@/server/tournaments/service';
import { NewTournamentForm } from './new-tournament-form';

export const metadata: Metadata = { title: 'Giải của tôi' };

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Nháp', cls: 'bg-surface-2 text-fg-2' },
  published: { label: 'Đang mở', cls: 'bg-success text-white' },
  ongoing: { label: 'Đang thi đấu', cls: 'bg-brand text-white' },
  finished: { label: 'Đã kết thúc', cls: 'bg-surface-2 text-fg-2' },
  cancelled: { label: 'Đã hủy', cls: 'bg-surface-2 text-muted' },
};

export default async function BtcHome({ searchParams }: { searchParams: Promise<{ btc?: string }> }) {
  const user = await requireUser();
  const orgs = await listMyOrganizations(user.id);
  if (orgs.length === 0) redirect('/btc/to-chuc/moi');
  const { btc } = await searchParams;
  const org = orgs.find((o) => o.id === btc) ?? orgs[0]!;
  const list = await listOrganizationTournaments(user.id, org.id);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <p className="text-sm text-muted">Ban tổ chức</p>
          <h1 className="display text-4xl leading-none">{org.name}</h1>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {orgs.length > 1 &&
            orgs
              .filter((o) => o.id !== org.id)
              .map((o) => (
                <a key={o.id} href={`/btc?btc=${o.id}`} className={buttonClass('secondary')}>
                  {o.name}
                </a>
              ))}
          <a href={`/btc/to-chuc/${org.id}/thanh-vien`} className={buttonClass('secondary')}>
            Thành viên BTC
          </a>
          <a href={`/btc/to-chuc/${org.id}`} className={buttonClass('secondary')}>
            Thông tin BTC &amp; tài khoản nhận tiền
          </a>
        </div>
      </div>

      {!org.bankAccountNo && (
        <p className="border border-gold bg-warning-bg px-3 py-2.5 text-sm text-warning-text">
          BTC chưa có tài khoản nhận tiền VietQR. Giải có thu phí cần thêm trước khi xuất bản.
        </p>
      )}

      <Card title="Tạo giải mới">
        <NewTournamentForm organizationId={org.id} />
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="display text-2xl">Giải của bạn</h2>
        {list.length === 0 && <p className="text-fg-2">Chưa có giải nào. Tạo giải đầu tiên ở trên — chỉ mất khoảng 5 phút.</p>}
        <ul className="flex flex-col border border-line">
          {list.map((t) => {
            const st = STATUS[t.status]!;
            return (
              <li key={t.id} className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-3 last:border-b-0">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <a href={`/btc/giai/${t.id}/thong-tin`} className="truncate text-lg font-bold hover:text-brand-text">
                    {t.name}
                  </a>
                  <span className="text-sm text-muted">
                    {t.startsAt ? formatDateTime(t.startsAt) : 'Chưa có ngày'} · {t.registered} VĐV · vattay.vn/{t.slug}
                  </span>
                </div>
                <span className={`px-2 py-1 text-xs font-bold ${st.cls}`}>{st.label}</span>
                {t.status !== 'draft' && (
                  <a href={`/${t.slug}`} className={buttonClass('ghost')}>
                    Xem trang giải
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
