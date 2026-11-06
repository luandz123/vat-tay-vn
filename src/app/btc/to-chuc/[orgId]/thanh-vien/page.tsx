import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { listMembers } from '@/server/organizations/members';
import { getOrganization } from '@/server/organizations/service';
import { AppError } from '@/server/shared/errors';
import { formatDateTime } from '@/server/shared/time';
import { InvitePanel, MemberActions } from './member-controls';

export const metadata: Metadata = { title: 'Thành viên BTC' };

export default async function MembersPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const user = await requireUser();
  const data = await Promise.all([getOrganization(user.id, orgId), listMembers(user.id, orgId)]).catch((e) => {
    if (e instanceof AppError) notFound();
    throw e;
  });
  const [org, { myRole, members, invites }] = data;
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <Link href={`/btc?btc=${org.id}`} className="text-sm text-muted hover:text-fg">← {org.name}</Link>
        <h1 className="display mt-1 text-4xl leading-none">Thành viên <span className="text-brand-text">BTC</span></h1>
        <p className="mt-2 text-fg-2">
          Thành viên quản lý được mọi giải của BTC: đăng ký, thu tiền, check-in, bảng đấu, kết quả. Chỉ <strong>chủ BTC</strong> mới sửa thông tin
          nhận tiền, mời/gỡ thành viên và xóa giải.
        </p>
      </div>

      <Card title={`${members.length} thành viên`}>
        {members.map((m) => (
          <div key={m.userId} className="flex flex-wrap items-center gap-3 border-b border-line pb-3 last:border-b-0">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-semibold">{m.fullName || m.email}</span>
              <span className="text-xs text-muted">{m.email} · từ {formatDateTime(m.joinedAt)}</span>
            </div>
            <span className={`px-2 py-0.5 text-xs font-bold ${m.role === 'owner' ? 'bg-brand text-white' : 'bg-surface-2 text-fg-2'}`}>
              {m.role === 'owner' ? 'Chủ BTC' : 'Thành viên'}
            </span>
            {(myRole === 'owner' || m.userId === user.id) && (
              <MemberActions orgId={org.id} memberUserId={m.userId} self={m.userId === user.id} name={m.fullName || m.email || ''} />
            )}
          </div>
        ))}
      </Card>

      {myRole === 'owner' && (
        <InvitePanel
          orgId={org.id}
          invites={invites.map((i) => ({ id: i.id, note: i.note, role: i.role, expiresAt: formatDateTime(i.expiresAt) }))}
        />
      )}
    </main>
  );
}
