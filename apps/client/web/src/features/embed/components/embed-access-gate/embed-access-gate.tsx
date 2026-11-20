import { useT } from '@kit/intl-react';
import { assertNever } from '@kit/result';
import { Link } from '@tanstack/react-router';
import { AccessGate } from '#app/components/watch/access-gate';
import type { VideoAccess } from '#app/lib/video-access/load-video-access';

export interface EmbedAccessGateProps {
  kind: Exclude<VideoAccess['kind'], 'open'>;
  videoId: string;
  shareToken?: string;
}

/**
 * `/embed/$videoId` for a video the frame may not play yet. The password is entered on the watch
 * page in a tab of its own: a third-party page's frame never sends the `SameSite=Lax` unlock
 * cookie, so an unlock inside it would not hold.
 */
export function EmbedAccessGate({ kind, videoId, shareToken }: EmbedAccessGateProps) {
  const { tOr } = useT();

  switch (kind) {
    case 'password':
      return (
        <main className="flex h-dvh w-dvw items-center justify-center overflow-auto bg-bg">
          <AccessGate.Root icon="lock" size="section">
            <AccessGate.Title>{tOr('watch.lockedTitle', {}, '')}</AccessGate.Title>
            <AccessGate.Action asChild variant="solid" tone="accent">
              <Link
                to="/watch/$videoId"
                params={{ videoId }}
                search={{ s: shareToken }}
                target="_blank"
                rel="noopener"
              >
                {tOr('watch.lockedOpenToWatch', {}, '')}
              </Link>
            </AccessGate.Action>
          </AccessGate.Root>
        </main>
      );
    case 'expired':
      return (
        <main className="flex h-dvh w-dvw items-center justify-center overflow-auto bg-bg">
          <AccessGate.Root icon="clock" size="section">
            <AccessGate.Title>{tOr('watch.linkExpiredTitle', {}, '')}</AccessGate.Title>
            <AccessGate.Description>
              {tOr('watch.linkExpiredDescription', {}, '')}
            </AccessGate.Description>
          </AccessGate.Root>
        </main>
      );
    default:
      return assertNever(kind, 'embed access');
  }
}
