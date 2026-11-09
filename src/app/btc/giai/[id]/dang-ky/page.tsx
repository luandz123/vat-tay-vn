import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonClass, cx } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { listRegistrations, listUnmatchedPayments, type RegistrationFilter } from '@/server/manage/registrations';
import { formatPhone } from '@/server/registration/rules';
import { getTournamentForEdit } from '@/server/tournaments/service';
import { OnsiteRegister } from './onsite-register';
import { RegistrationTable } from './registration-table';
import { UnmatchedPayments } from './unmatched-payments';

export const metadata: Metadata = { title: 'Đăng ký & thanh toán' };

const TABS: { key: RegistrationFilter; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'pending', label: 'Chờ duyệt' },
  { key: 'unpaid', label: 'Chưa đóng đủ' },
  { key: 'age_warning', label: 'Năm sinh không hợp lệ' },
  { key: 'not_checked_in', label: 'Chưa check-in' },
];

export default async function RegistrationsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ loc?: string; q?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const filter = (TABS.find((t) => t.key === sp.loc)?.key ?? 'all') as RegistrationFilter;
  const user = await requireUser();
  const [rows, unmatched, d] = await Promise.all([
    listRegistrations(user.id, id, filter, sp.q ?? ''),
    listUnmatchedPayments(user.id, id),
    getTournamentForEdit(user.id, id),
  ]);
  const weights = d.categories.filter((c) => c.kind === 'weight').map((c) => ({ id: c.id, hand: c.hand, gender: c.gender, label: c.label }));

  return (
    <main className="flex flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="display text-3xl">Đăng ký &amp; thanh toán</h1>
        <div className="ml-auto flex flex-wrap gap-2">
          <a href={`/btc/giai/${id}/xuat-excel`} className={buttonClass('secondary')}>Xuất Excel</a>
          <OnsiteRegister tournamentId={id} categories={weights} />
        </div>
      </div>

      {unmatched.length > 0 && (
        <UnmatchedPayments
          tournamentId={id}
          payments={unmatched.map((p) => ({ id: p.id, amount: p.amount, content: p.transferContent ?? '', receivedAt: p.receivedAt.toISOString() }))}
          registrations={rows.map((r) => ({ id: r.id, label: `${r.code} · ${r.athlete.fullName} · còn ${r.amountDue - r.amountPaid}` }))}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <Link
              key={t.key}
              role="tab"
              aria-selected={t.key === filter}
              href={`?loc=${t.key}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ''}`}
              className={cx('flex min-h-9 items-center border border-line-strong px-3 text-sm font-semibold', t.key === filter ? 'bg-fg text-bg' : 'text-fg-2')}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <form className="ml-auto flex gap-2" action="">
          <input type="hidden" name="loc" value={filter} />
          <label className="sr-only" htmlFor="q">Tìm VĐV</label>
          <input id="q" name="q" defaultValue={sp.q} placeholder="Tìm tên, SĐT, mã…" className="min-h-10 w-56 border border-line-strong bg-bg px-3 text-sm" />
          <button className={buttonClass('secondary')}>Tìm</button>
        </form>
      </div>

      <RegistrationTable
        tournamentId={id}
        rows={rows.map((r) => ({
          id: r.id,
          code: r.code,
          name: r.athlete.fullName,
          phone: formatPhone(r.athlete.phone),
          phoneRaw: r.athlete.phone,
          club: r.athlete.club,
          birthYear: r.athlete.birthYear,
          ageWarning: r.ageWarning,
          ageVerified: r.ageVerified,
          categories: r.entries.map((e) => `${e.category.hand === 'right' ? 'P' : 'T'} ${e.category.label}`).join(' · '),
          amountDue: r.amountDue,
          amountPaid: r.amountPaid,
          paymentStatus: r.paymentStatus,
          status: r.status,
          source: r.source,
          checkedIn: !!r.checkedInAt,
          note: r.note,
          ticketToken: r.ticketToken,
        }))}
      />
      <p className="text-sm text-muted">Hiển thị {rows.length} đăng ký (tối đa 500). Trạng thái “Đã đóng” tự cập nhật khi tiền về qua SePay.</p>
    </main>
  );
}
