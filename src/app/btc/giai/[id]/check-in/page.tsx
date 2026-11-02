import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { listRegistrations } from '@/server/manage/registrations';
import { formatPhone } from '@/server/registration/rules';
import { CheckinApp } from './checkin-app';

export const metadata: Metadata = { title: 'Check-in & cân' };

export default async function CheckinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const rows = await listRegistrations(user.id, id);
  return (
    <CheckinApp
      tournamentId={id}
      people={rows.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.athlete.fullName,
        phone: formatPhone(r.athlete.phone),
        cats: r.entries.map((e) => `${e.category.hand === 'right' ? 'P' : 'T'} ${e.category.label}`).join(' · '),
        weighed: r.weighedKg !== null,
        paid: r.paymentStatus === 'paid',
      }))}
    />
  );
}
