import { Logo } from '@/components/ui';

// Tạm thời: form đăng ký làm ở Sprint 2.
export default async function RegisterPlaceholder({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-4 text-center">
      <Logo />
      <h1 className="display text-4xl leading-none">Đăng ký online sắp mở</h1>
      <p className="text-fg-2">Chức năng đăng ký đang được hoàn thiện. Vui lòng liên hệ BTC để giữ chỗ.</p>
      <a href={`/${slug}`} className="font-semibold text-brand-text">← Về trang giải</a>
    </main>
  );
}
