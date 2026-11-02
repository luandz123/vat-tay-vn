import { NextResponse, type NextRequest } from 'next/server';
import { completeSignIn } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const nextParam = url.searchParams.get('next') ?? '/btc';
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/btc';
  if (!code) return NextResponse.redirect(new URL('/dang-nhap?loi=1', url.origin));
  try {
    await completeSignIn(code);
    return NextResponse.redirect(new URL(next, url.origin));
  } catch {
    return NextResponse.redirect(new URL('/dang-nhap?loi=1', url.origin));
  }
}
