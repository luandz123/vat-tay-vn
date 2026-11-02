import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { auditLog } from '@/server/admin/service';
import { formatDateTime } from '@/server/shared/time';

export const metadata: Metadata = { title: 'Nhật ký thay đổi kết quả' };

const ACTION: Record<string, string> = {
  'result.set': 'Ghi kết quả', 'result.undo': 'Hoàn tác kết quả', 'bracket.generate': 'Tạo bảng', 'bracket.redraw': 'Bốc thăm lại', 'bracket.swap': 'Đổi vị trí', 'entry.move': 'Chuyển hạng',
};

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ giai?: string; tatca?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const rows = await auditLog(user.id, { tournamentId: sp.giai, onlyResults: !sp.tatca });
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="display text-3xl">Nhật ký thay đổi</h1>
        <a href={sp.tatca ? '?' : '?tatca=1'} className="ml-auto text-sm font-semibold text-brand-text">{sp.tatca ? 'Chỉ kết quả & bảng đấu' : 'Xem mọi thao tác'}</a>
      </div>
      <div className="overflow-x-auto border border-line bg-surface">
        <table className="w-full min-w-[820px] text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-wider text-muted"><th className="p-2.5">Thời gian</th><th className="p-2.5">Giải</th><th className="p-2.5">Người làm</th><th className="p-2.5">Thao tác</th><th className="p-2.5">Chi tiết</th></tr></thead>
          <tbody>
            {rows.map(({ log, actorEmail, tableName, tournamentName }) => (
              <tr key={log.id} className="border-t border-line align-top">
                <td className="whitespace-nowrap p-2.5">{formatDateTime(log.createdAt)}</td>
                <td className="p-2.5">{tournamentName ?? '—'}</td>
                <td className="p-2.5">{actorEmail ?? (tableName ? `Tablet ${tableName}` : 'Hệ thống')}</td>
                <td className="p-2.5 font-semibold">{ACTION[log.action] ?? log.action}</td>
                <td className="p-2.5 font-mono text-xs text-fg-2">{JSON.stringify({ trước: log.before, sau: log.after })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
