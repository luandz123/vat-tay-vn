import { NextResponse } from 'next/server';
import { getPaymentState } from '@/server/registration/service';

export const dynamic = 'force-dynamic';

/** Trang vé hỏi định kỳ để tự chuyển sang "Đã đóng". */
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const state = /^[A-Za-z0-9_-]{20,40}$/.test(token) ? await getPaymentState(token) : null;
  if (!state) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } });
}
