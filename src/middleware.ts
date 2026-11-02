import type { NextRequest } from 'next/server';
import { refreshSession } from '@/lib/auth';

export function middleware(request: NextRequest) {
  return refreshSession(request);
}

export const config = {
  // Chỉ khu BTC/admin cần phiên; trang giải công khai không đi qua middleware cho nhanh.
  matcher: ['/btc/:path*', '/admin/:path*', '/auth/:path*'],
};
