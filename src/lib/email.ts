/**
 * Gửi email qua Resend (gói miễn phí). Chưa cấu hình RESEND_API_KEY thì bỏ qua, trả về false.
 * Khi chuyển NestJS: giữ nguyên chữ ký sendEmails.
 */
export interface Email {
  to: string;
  subject: string;
  text: string;
}

export function emailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

/** Gửi lần lượt theo lô (Resend batch tối đa 100). Trả số email gửi thành công. */
export async function sendEmails(emails: Email[]): Promise<number> {
  if (!emailEnabled() || emails.length === 0) return 0;
  let sent = 0;
  for (let i = 0; i < emails.length; i += 100) {
    const batch = emails.slice(i, i + 100).map((e) => ({ from: process.env.EMAIL_FROM, to: [e.to], subject: e.subject, text: e.text }));
    const res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    }).catch(() => null);
    if (res?.ok) sent += batch.length;
  }
  return sent;
}
