'use client';

import { useState, useTransition } from 'react';
import { finishTournamentAction } from '@/app/btc/manage-actions';
import { Button } from '@/components/ui';

export function FinishButton({ tournamentId }: { tournamentId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="primary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            let r = await finishTournamentAction(tournamentId, false);
            if (!r.ok && confirm(`${r.error}. Vẫn kết thúc giải?`)) r = await finishTournamentAction(tournamentId, true);
            setError(r.ok ? undefined : r.error);
          })
        }
      >
        Kết thúc giải
      </Button>
      {error && <span className="text-xs text-brand-text">{error}</span>}
    </div>
  );
}
