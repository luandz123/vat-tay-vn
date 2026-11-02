/** Banner thông báo và báo cáo thu chi công khai (dùng trên trang giải và trang vé). */
import { formatDateTime, formatVnd } from '@/server/shared/time';

export function NoticeBanner({ banner }: { banner: { title: string; body: string; sentAt: Date } | null }) {
  if (!banner) return null;
  return (
    <div role="status" className="mx-4 mt-4 flex flex-col gap-1 border border-gold bg-warning-bg p-3.5 text-warning-text">
      <strong>📢 {banner.title}</strong>
      <span className="whitespace-pre-line text-sm">{banner.body}</span>
      <span className="text-xs opacity-80">BTC thông báo lúc {formatDateTime(banner.sentAt)}</span>
    </div>
  );
}

const METHOD: Record<string, string> = { vietqr: 'Chuyển khoản', cash: 'Tiền mặt', manual: 'Xác nhận tay' };

export function FinanceSummary({
  data,
}: {
  data: { income: { method: string; total: number }[]; expenses: { id: string; title: string; amount: number }[]; totalIncome: number; totalExpense: number; balance: number } | null;
}) {
  if (!data) return null;
  return (
    <section className="flex flex-col gap-3 px-4 pt-8">
      <h2 className="display text-3xl text-brand-text">Thu chi minh bạch</h2>
      <div className="flex flex-col border border-line bg-surface text-sm">
        {data.income.map((i) => (
          <div key={i.method} className="flex justify-between border-b border-line px-3.5 py-2.5"><span>Thu · {METHOD[i.method] ?? i.method}</span><span>{formatVnd(i.total)}</span></div>
        ))}
        {data.expenses.map((e) => (
          <div key={e.id} className="flex justify-between border-b border-line px-3.5 py-2.5"><span>Chi · {e.title}</span><span>-{formatVnd(e.amount)}</span></div>
        ))}
        <div className="flex justify-between px-3.5 py-3 font-bold"><span>Còn lại</span><span>{formatVnd(data.balance)}</span></div>
      </div>
    </section>
  );
}
