'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '@/components/ui';

export function ManageNav({ id, published, slug }: { id: string; published: boolean; slug: string }) {
  const path = usePathname();
  const base = `/btc/giai/${id}`;
  const groups: { title: string; items: { href: string; label: string; active?: boolean }[] }[] = [
    {
      title: 'Giải đấu',
      items: [
        { href: base, label: 'Tổng quan', active: path === base },
        { href: `${base}/dang-ky`, label: 'Đăng ký & thanh toán' },
        { href: `${base}/thong-bao`, label: 'Thông báo & dời lịch' },
        { href: `${base}/thu-chi`, label: 'Báo cáo thu chi' },
      ],
    },
    {
      title: 'Ngày thi đấu',
      items: [
        { href: `${base}/check-in`, label: 'Check-in & cân' },
        { href: `${base}/bang-dau`, label: 'Bảng đấu & bàn' },
        { href: `${base}/ket-qua`, label: 'Kết quả & bằng khen' },
      ],
    },
    {
      title: 'Thiết lập',
      items: [
        { href: `${base}/thong-tin`, label: 'Sửa thông tin giải', active: /\/(thong-tin|hang-muc|le-phi|lich-giai-thuong|xuat-ban)$/.test(path) },
        ...(published ? [{ href: `/${slug}`, label: 'Xem trang giải ↗' }] : []),
      ],
    },
  ];
  return (
    <nav aria-label="Quản lý giải" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {groups.map((g) => (
        <div key={g.title} className="flex shrink-0 gap-1 lg:flex-col">
          <span className="hidden px-2 pb-1 pt-3 text-[11px] uppercase tracking-widest text-muted lg:block">{g.title}</span>
          {g.items.map((it) => {
            const active = it.active ?? path.startsWith(it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                className={cx(
                  'flex min-h-10 shrink-0 items-center whitespace-nowrap border-l-[3px] px-2.5 text-sm font-semibold',
                  active ? 'border-brand bg-surface-2 text-fg' : 'border-transparent text-fg-2 hover:text-fg',
                )}
              >
                {it.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
