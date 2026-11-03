import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicBoard } from '@/server/brackets/public';
import { isValidSlug } from '@/server/tournaments/slug';
import { CallScreen } from './call-screen';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Màn hình gọi VĐV', robots: { index: false } };

/** Màn hình chiếu TV tại sân: mỗi bàn hiện trận đang đấu + trận chuẩn bị, chữ lớn, tự cập nhật. */
export default async function CallScreenPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = isValidSlug(slug) ? await getPublicBoard(slug) : null;
  if (!data) notFound();
  return <CallScreen slug={slug} initial={data} host={(process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/^https?:\/\//, '')} />;
}
