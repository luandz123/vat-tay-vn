'use client';

import { useTransition } from 'react';
import { setTournamentStatusAction, setUserRoleAction } from './actions';

const STATUS = { draft: 'Nháp', published: 'Đang mở', ongoing: 'Đang đấu', finished: 'Kết thúc', cancelled: 'Đã hủy/ẩn' };

export function StatusSelect({ tournamentId, status }: { tournamentId: string; status: string }) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label="Trạng thái giải"
      disabled={pending}
      defaultValue={status}
      onChange={(e) => {
        const v = e.target.value;
        if (confirm(`Đổi trạng thái giải sang "${STATUS[v as keyof typeof STATUS]}"?`)) start(async () => { await setTournamentStatusAction(tournamentId, v); });
        else e.target.value = status;
      }}
      className="min-h-9 border border-line-strong bg-bg px-2"
    >
      {Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
    </select>
  );
}

export function RoleToggle({ userId, role, self }: { userId: string; role: string; self: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending || self}
      onClick={() => start(async () => { await setUserRoleAction(userId, role === 'admin' ? 'user' : 'admin'); })}
      className={`min-h-8 border px-2 text-xs font-bold ${role === 'admin' ? 'border-brand text-brand-text' : 'border-line-strong text-fg-2'}`}
    >
      {role === 'admin' ? 'Admin' : 'Người dùng'}
    </button>
  );
}
