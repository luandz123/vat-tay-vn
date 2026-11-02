'use client';

import { useState, useTransition } from 'react';
import { rotateWebhookSecretAction } from '@/app/btc/actions';
import { Alert, Button, Card } from '@/components/ui';

export function SepayConnect({ orgId, webhookUrl, connected }: { orgId: string; webhookUrl: string; connected: boolean }) {
  const [secret, setSecret] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <Card title="Tự động xác nhận chuyển khoản (SePay)">
      <p className="text-sm text-fg-2">
        Kết nối tài khoản ngân hàng của BTC với{' '}
        <a href="https://sepay.vn" target="_blank" rel="noreferrer" className="text-brand-text underline">SePay</a>{' '}
        để trạng thái “Đã đóng” tự cập nhật khi VĐV chuyển khoản. Không kết nối thì BTC xác nhận tay trong danh sách đăng ký.
      </p>
      <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-fg-2">
        <li>Tạo tài khoản SePay, liên kết tài khoản ngân hàng nhận lệ phí.</li>
        <li>Vào SePay → Webhooks → Thêm webhook, chọn sự kiện <strong>Có tiền vào</strong>.</li>
        <li>
          URL webhook: <code className="break-all bg-bg px-1.5 py-0.5 text-fg">{webhookUrl}</code>
        </li>
        <li>Kiểu chứng thực: <strong>API Key</strong>, dán API key tạo ở dưới.</li>
      </ol>
      {secret ? (
        <Alert tone="success">
          API key (chỉ hiện một lần, hãy dán vào SePay ngay): <code className="break-all font-bold">{secret}</code>
        </Alert>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                if (connected && !confirm('Tạo key mới sẽ làm key cũ hết hiệu lực. Tiếp tục?')) return;
                const r = await rotateWebhookSecretAction(orgId);
                if (r.ok) setSecret(r.data.secret);
                else setError(r.error);
              })
            }
          >
            {connected ? 'Tạo API key mới' : 'Tạo API key'}
          </Button>
          {connected && <span className="text-sm text-success-text">Đã có API key</span>}
        </div>
      )}
      {error && <Alert tone="error">{error}</Alert>}
    </Card>
  );
}
