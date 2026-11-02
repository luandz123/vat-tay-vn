import { NextResponse, type NextRequest } from 'next/server';
import { signOut } from '@/lib/auth';

export async function POST(request: NextRequest) {
  await signOut();
  return NextResponse.redirect(new URL('/', request.url), { status: 303 });
}
