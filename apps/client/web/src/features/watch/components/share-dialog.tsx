import { useRouter } from '@tanstack/react-router';
import type { Video } from '@vp/api-contracts';
import { videoDuration } from '@vp/intl';
import { useFormat, useT } from '@vp/intl-react';
import { unwrapOr } from '@vp/result';
import { Button, Checkbox, Dialog, Field, Input, Label, useUiCopy } from '@vp/ui';
import { useState } from 'react';

import { EngagementBar } from '#app/components/watch/engagement-bar';
import { usePlayerSeek } from '#app/features/player';
import { useCopyLink } from '#app/hooks/use-copy-link';

function ShareDialogBody({ videoId, startAt }: { videoId: string; startAt: number }) {
  const router = useRouter();
  const copyLink = useCopyLink();
  const { tOr } = useT();
  const { format } = useFormat();
  const { copy } = useUiCopy();
  const [withTime, setWithTime] = useState(false);

  const { href } = router.buildLocation({
    to: '/watch/$videoId',
    params: { videoId },
    search: { t: withTime ? startAt : undefined },
  });
  const link = new URL(href, window.location.origin).toString();

  return (
    <Dialog.Body className="tw:flex tw:flex-col tw:gap-stack">
      <div className="tw:flex tw:items-end tw:gap-inline">
        <Field.Root className="tw:flex-1">
          <Field.Label>{tOr('watch.shareLink', {}, '')}</Field.Label>
          <Input readOnly value={link} onFocus={(event) => event.currentTarget.select()} />
        </Field.Root>
        <Button onClick={() => copyLink(link)}>{copy}</Button>
      </div>
      {startAt > 0 && (
        <Label className="tw:flex tw:items-center tw:gap-inline">
          <Checkbox checked={withTime} onCheckedChange={(next) => setWithTime(next === true)} />
          {tOr('watch.shareStartAt', { time: unwrapOr(format(videoDuration(startAt)), '') }, '')}
        </Label>
      )}
    </Dialog.Body>
  );
}

/** What a share dialog holds: the link to a video, and optionally the moment `startAt` seconds in. */
export function ShareDialogContent({ videoId, startAt }: { videoId: string; startAt: number }) {
  const { tOr } = useT();

  return (
    <Dialog.Content aria-describedby={undefined}>
      <Dialog.Header>
        <Dialog.Title>{tOr('watch.shareTitle', {}, '')}</Dialog.Title>
      </Dialog.Header>
      <ShareDialogBody videoId={videoId} startAt={startAt} />
    </Dialog.Content>
  );
}

/** The Share action of a video's engagement bar: a dialog with its link and, optionally, the playhead. */
export function ShareDialog({ video }: { video: Pick<Video, 'id'> }) {
  const { currentTime } = usePlayerSeek();
  const { tOr } = useT();
  const [startAt, setStartAt] = useState(0);

  return (
    <Dialog.Root onOpenChange={(open) => open && setStartAt(Math.floor(currentTime()))}>
      <Dialog.Trigger asChild>
        <EngagementBar.Action icon="share">{tOr('watch.share', {}, '')}</EngagementBar.Action>
      </Dialog.Trigger>
      <ShareDialogContent videoId={video.id} startAt={startAt} />
    </Dialog.Root>
  );
}
