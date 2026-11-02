import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { getFinance } from '@/server/finance/service';
import { FinanceView } from './finance-view';

export const metadata: Metadata = { title: 'Báo cáo thu chi' };

export default async function FinancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const f = await getFinance(user.id, id);
  return (
    <main className="flex flex-col gap-5 p-4 sm:p-6">
      <h1 className="display text-3xl">Báo cáo thu chi</h1>
      <FinanceView tournamentId={id} data={{ ...f, expenses: f.expenses.map((e) => ({ id: e.id, title: e.title, amount: e.amount })) }} />
    </main>
  );
}
