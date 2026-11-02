import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-4 py-16 text-center">
      <p className="display text-2xl">
        Vật<span className="text-brand-text">Tay</span>
        <span className="text-sm text-muted">.vn</span>
      </p>
      <h1 className="display text-5xl leading-[0.95]">
        Tổ chức giải vật tay <span className="text-brand-text">trong 5 phút</span>
      </h1>
      <p className="text-fg-2">
        Tạo giải, nhận đăng ký không cần tài khoản, thu phí VietQR về thẳng tài khoản BTC, xếp bảng và cập nhật kết quả
        trực tiếp.
      </p>
      <div className="flex justify-center">
        <Link
          href="/btc"
          className="display btn-slant inline-flex min-h-12 items-center bg-brand px-8 text-lg text-white hover:brightness-110"
        >
          Tạo giải ngay
        </Link>
      </div>
      <p className="text-sm text-muted">Đang xây dựng · Sprint 0</p>
    </main>
  );
}
