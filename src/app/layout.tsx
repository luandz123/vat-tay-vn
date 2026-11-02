import type { Metadata, Viewport } from 'next';
import { Barlow, Barlow_Condensed } from 'next/font/google';
import './globals.css';

const barlow = Barlow({
  variable: '--font-barlow',
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
});

const barlowCondensed = Barlow_Condensed({
  variable: '--font-barlow-condensed',
  subsets: ['latin', 'vietnamese'],
  weight: ['600', '700', '800'],
  style: ['normal', 'italic'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: { default: 'VậtTay.vn', template: '%s · VậtTay.vn' },
  description: 'Tạo giải vật tay, nhận đăng ký, thu phí VietQR, xếp bảng và cập nhật kết quả trên một nền tảng.',
};

export const viewport: Viewport = { themeColor: '#0b0c10' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body className={`${barlow.variable} ${barlowCondensed.variable} antialiased`}>{children}</body>
    </html>
  );
}
