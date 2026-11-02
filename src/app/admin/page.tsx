import type { Metadata } from 'next';
import { Card, buttonClass } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { adminOverview } from '@/server/admin/service';
import { formatDateTime } from '@/server/shared/time';
import { RoleToggle, StatusSelect } from './controls';

export const metadata: Metadata = { title: 'Admin' };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  const user = await requireUser();
  const d = await adminOverview(user.id, q);
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="display text-3xl">Quản trị nền tảng</h1>
        <form className="ml-auto flex gap-2">
          <label className="sr-only" htmlFor="q">Tìm</label>
          <input id="q" name="q" defaultValue={q} placeholder="Tìm email, BTC, giải…" className="min-h-10 w-64 border border-line-strong bg-bg px-3 text-sm" />
          <button className={buttonClass('secondary')}>Tìm</button>
        </form>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {[['Người dùng', d.counts.users], ['Ban tổ chức', d.counts.orgs], ['Giải đấu', d.counts.tournaments], ['Lượt đăng ký', d.counts.registrations]].map(([l, v]) => (
          <div key={l} className="flex flex-col gap-1 border border-line bg-surface p-4">
            <span className="text-xs uppercase tracking-wider text-muted">{l}</span>
            <span className="font-display text-4xl font-bold">{v}</span>
          </div>
        ))}
      </div>

      <Card title="Giải đấu">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wider text-muted"><th className="p-2">Giải</th><th className="p-2">BTC</th><th className="p-2">Ngày</th><th className="p-2">VĐV</th><th className="p-2">Trạng thái</th></tr></thead>
            <tbody>
              {d.tournaments.map((t) => (
                <tr key={t.id} className="border-t border-line">
                  <td className="p-2"><a href={`/${t.slug}`} className="font-semibold hover:text-brand-text">{t.name}</a><div className="text-xs text-muted">/{t.slug}</div></td>
                  <td className="p-2">{t.org}</td>
                  <td className="p-2">{t.startsAt ? formatDateTime(t.startsAt) : '—'}</td>
                  <td className="p-2">{t.registered}</td>
                  <td className="p-2"><StatusSelect tournamentId={t.id} status={t.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Ban tổ chức">
          {d.organizations.map((o) => (
            <div key={o.id} className="flex justify-between border-b border-line pb-2 text-sm last:border-b-0">
              <span className="font-semibold">{o.name}</span>
              <span className="text-muted">{o.tournaments} giải · {o.sepay ? 'đã nối SePay' : 'chưa nối SePay'}</span>
            </div>
          ))}
        </Card>
        <Card title="Người dùng">
          {d.users.map((u) => (
            <div key={u.id} className="flex items-center gap-2 border-b border-line pb-2 text-sm last:border-b-0">
              <span className="flex-1 truncate">{u.email}<span className="text-muted"> · {u.orgs} BTC</span></span>
              <RoleToggle userId={u.id} role={u.role} self={u.id === user.id} />
            </div>
          ))}
        </Card>
      </div>
    </main>
  );
}
