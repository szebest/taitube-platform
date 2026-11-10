import { useT } from '@vp/intl-react';
import type { WatchPartySocket } from '@vp/queries';
import { Badge, Button } from '@vp/ui';
import { usePartySync } from '#app/features/watch-party/hooks/use-party-sync';
import { getSyncBadge } from '#app/features/watch-party/utils/get-sync-badge';

/** Rendered inside the player: keeps it on the room's clock, and shows how well it does. */
export function PartySyncOverlay({ socket }: { socket: WatchPartySocket }) {
  const { state, serverNow, send } = socket;
  const { tOr } = useT();
  const { soundBlocked, enableSound, catchingUp } = usePartySync({ state, serverNow, send });
  const badge = getSyncBadge(state.connection === 'open', catchingUp);

  return (
    <div className="pointer-events-none absolute inset-bs-inset-card inset-s-inset-card flex flex-col items-start gap-inline [&>*]:pointer-events-auto">
      <Badge variant="scrim" tone={badge.tone} role="status">
        {tOr(badge.copy, {}, '')}
      </Badge>
      {soundBlocked && (
        <Button size="sm" tone="accent" variant="solid" onClick={enableSound}>
          {tOr('party.stageTapForSound', {}, '')}
        </Button>
      )}
    </div>
  );
}
