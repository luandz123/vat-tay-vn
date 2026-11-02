import { NextResponse } from 'next/server';
import { getPublicBoard } from '@/server/brackets/public';
import { isValidSlug } from '@/server/tournaments/slug';

/** Dữ liệu trực tiếp cho khán giả. Cache CDN 3 giây: 300 người xem chỉ tạo ~1 truy vấn DB / 3 giây. */
export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = isValidSlug(slug) ? await getPublicBoard(slug) : null;
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(data, { headers: { 'Cache-Control': 'public, s-maxage=3, stale-while-revalidate=10' } });
}
