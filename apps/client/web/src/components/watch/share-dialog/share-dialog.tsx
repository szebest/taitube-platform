import type { Video } from '@vp/api-contracts';
import { videoDuration } from '@vp/intl';
import { useFormat, useT } from '@vp/intl-react';
import { fromPromise, unwrapOr } from '@vp/result';
import { Button, Checkbox, Label, ResponsiveModal, useUiCopy } from '@vp/ui';
import { useId, useState } from 'react';
import { usePlayerSeek } from '#app/components/player/taitube-player';
import { EngagementBar } from '#app/components/watch/engagement-bar';
import { useCopyLink } from '#app/hooks/use-copy-link';
import { type ShareKind, shareUrl } from '#app/lib/share/share-url';
import { SOCIAL_TARGETS } from '#app/lib/share/social-targets';
import { splitLink } from './utils/split-link';

const LINK_TAIL_LENGTH = 14;

function ShareLink({ link, labelledBy }: { link: string; labelledBy: string }) {
  const { head, tail } = splitLink(link, LINK_TAIL_LENGTH);

  return (
    <div
      aria-labelledby={labelledBy}
      aria-readonly="true"
      className="flex h-control-md min-w-0 flex-1 items-center rounded-control border-control border-border-strong bg-surface px-inset-control font-sans text-body text-fg select-text focus-ring"
      role="textbox"
      tabIndex={0}
      onFocus={(event) => window.getSelection()?.selectAllChildren(event.currentTarget)}
    >
      <span className="min-w-0 truncate">{head}</span>
      <span className="shrink-0">{tail}</span>
    </div>
  );
}

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
  const copyLink = useCopyLink();
  const { tOr } = useT();
  const { format } = useFormat();
  const { copy } = useUiCopy();
  const labelId = useId();
  const [withTime, setWithTime] = useState(false);

  const text = title ?? '';
  const link = shareUrl(kind, id, {
    origin: window.location.origin,
    startAt: withTime ? startAt : 0,
  });
  const canShareNatively = typeof navigator.share === 'function';

  const shareNatively = async () => {
    unwrapOr(
      await fromPromise(
        () => navigator.share({ title: text, url: link }),
        (cause) => cause
      ),
      undefined
    );
  };

  return (
    <ResponsiveModal.Body className="flex min-w-0 flex-col gap-stack">
      <div className="flex min-w-0 flex-col gap-inline">
        <span id={labelId} className="text-label">
          {tOr('watch.shareLink', {}, '')}
        </span>
        <div className="flex min-w-0 items-center gap-inline">
          <ShareLink link={link} labelledBy={labelId} />
          <Button className="shrink-0" onClick={() => copyLink(link)}>
            {copy}
          </Button>
        </div>
      </div>
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
        {canShareNatively && (
          <li>
            <Button variant="outline" size="sm" onClick={shareNatively}>
              {tOr('share.native', {}, '')}
            </Button>
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
