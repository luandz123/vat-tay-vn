import { NextResponse, type NextRequest } from 'next/server';
import { publish, tournamentChannel } from '@/lib/realtime';
import { handleSepayWebhook } from '@/server/payments/sepay';

export async function POST(request: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const body = await request.json().catch(() => null);
  const result = await handleSepayWebhook(orgId, request.headers.get('authorization'), body);
  if (result.status === 'unauthorized') return NextResponse.json({ success: false }, { status: 401 });
  if (result.status === 'matched') {
    await publish(tournamentChannel(result.tournamentId), { type: 'registration.paid', registrationId: result.registrationId }).catch(() => undefined);
  }
  // SePay coi 200 + success:true là đã nhận; trả 200 cả khi bỏ qua để không bị gửi lại mãi.
  return NextResponse.json({ success: true, status: result.status });
}
