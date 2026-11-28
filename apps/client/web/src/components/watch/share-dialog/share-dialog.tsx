import { useFormat } from '@kit/intl-react';
import { unwrapOr } from '@kit/result';
import { Button, Checkbox, Label, ResponsiveModal } from '@kit/ui';
import type { Video } from '@vp/api-contracts';
import { videoDuration } from '@vp/intl-formats';
import { useState } from 'react';
import { usePlayerSeek } from '#app/components/player/taitube-player';
import { EngagementBar } from '#app/components/watch/engagement-bar';
import { useT } from '#app/lib/messages';
import { type ShareKind, shareUrl } from '#app/lib/share/share-url';
import { SOCIAL_TARGETS } from '#app/lib/share/social-targets';
import { canShareNatively, ShareLinkField, ShareNativeButton } from './share-link';

function ShareBody({
  kind,
  id,
  title,
  startAt,
}: {
  kind: ShareKind;
  id: string;
  title: string | null;
  startAt: number;
}) {
  const { tOr } = useT();
  const { format } = useFormat();
  const [withTime, setWithTime] = useState(false);

  const text = title ?? '';
  const link = shareUrl(kind, id, {
    origin: window.location.origin,
    startAt: withTime ? startAt : 0,
  });

  return (
    <ResponsiveModal.Body className="flex min-w-0 flex-col gap-stack">
      <ShareLinkField link={link} label={tOr('watch.shareLink', {}, '')} />
      {kind === 'watch' && startAt > 0 && (
        <Label className="flex items-center gap-inline">
          <Checkbox checked={withTime} onCheckedChange={(next) => setWithTime(next === true)} />
          {tOr('watch.shareStartAt', { time: unwrapOr(format(videoDuration(startAt)), '') }, '')}
        </Label>
      )}
      <ul
        className="m-0 flex list-none flex-wrap gap-inline p-0"
        aria-label={tOr('share.targets', {}, '')}
      >
        {SOCIAL_TARGETS.map((target) => (
          <li key={target.id}>
            <Button asChild variant="outline" size="sm">
              <a
                href={target.href({ url: link, title: text })}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={tOr('share.onTarget', { target: target.name }, '')}
              >
                {target.name}
              </a>
            </Button>
          </li>
        ))}
        {canShareNatively() && (
          <li>
            <ShareNativeButton title={text} link={link} />
          </li>
        )}
      </ul>
    </ResponsiveModal.Body>
  );
}

interface ShareDialogContentProps {
  kind: ShareKind;
  id: string;
  title: string | null;
  startAt: number;
}

/** What a share dialog holds: the link to a video or a short, optionally the moment `startAt` seconds in, and where to send it. */
export function ShareDialogContent({ kind, id, title, startAt }: ShareDialogContentProps) {
  const { tOr } = useT();

  return (
    <ResponsiveModal.Content aria-describedby={undefined}>
      <ResponsiveModal.Header>
        <ResponsiveModal.Title>
          {tOr(kind === 'shorts' ? 'share.shortTitle' : 'watch.shareTitle', {}, '')}
        </ResponsiveModal.Title>
      </ResponsiveModal.Header>
      <ShareBody kind={kind} id={id} title={title} startAt={startAt} />
    </ResponsiveModal.Content>
  );
}

type ShareableVideo = Pick<Video, 'id' | 'title'>;

/** The Share action of a video's engagement bar: a dialog with its link and, optionally, the playhead. */
export function ShareDialog({ video }: { video: ShareableVideo }) {
  const { currentTime } = usePlayerSeek();
  const { tOr } = useT();
  const [startAt, setStartAt] = useState(0);

  return (
    <ResponsiveModal.Root onOpenChange={(open) => open && setStartAt(Math.floor(currentTime()))}>
      <ResponsiveModal.Trigger asChild>
        <EngagementBar.Action icon="share">{tOr('watch.share', {}, '')}</EngagementBar.Action>
      </ResponsiveModal.Trigger>
      <ShareDialogContent kind="watch" id={video.id} title={video.title} startAt={startAt} />
    </ResponsiveModal.Root>
  );
}
