import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo, buttonClass } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth';
import { peekInvite } from '@/server/organizations/members';
import { AcceptButton } from './accept-button';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Lời mời tham gia BTC', robots: { index: false } };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [info, user] = await Promise.all([peekInvite(token), getCurrentUser()]);
  const next = encodeURIComponent(`/moi/${token}`);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-4 py-12">
      <Link href="/" aria-label="Trang chủ"><Logo /></Link>
      {!info || info.state !== 'valid' ? (
        <>
          <h1 className="display text-4xl leading-none">Link mời không dùng được</h1>
          <p className="text-fg-2">
            {!info ? 'Link không tồn tại.' : info.state === 'expired' ? 'Link đã hết hạn (7 ngày).' : 'Link đã được dùng hoặc đã bị thu hồi.'} Hãy xin chủ BTC một link mới.
          </p>
        </>
      ) : (
        <>
          <h1 className="display text-4xl leading-none">
            Tham gia <span className="text-brand-text">{info.orgName}</span>
          </h1>
          <p className="text-fg-2">
            Bạn được mời làm {info.role === 'owner' ? 'đồng chủ' : 'thành viên'} Ban tổ chức: quản lý đăng ký, check-in, bảng đấu và kết quả các giải của BTC này.
          </p>
          {user ? (
            <>
              <p className="text-sm text-muted">Đang đăng nhập: {user.email}</p>
              <AcceptButton token={token} />
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <Link href={`/dang-nhap?tao=1&next=${next}`} className={buttonClass('primary')}>Tạo tài khoản để tham gia</Link>
              <Link href={`/dang-nhap?next=${next}`} className={buttonClass('secondary')}>Tôi đã có tài khoản — đăng nhập</Link>
            </div>
          )}
        </>
      )}
    </main>
  );
}
