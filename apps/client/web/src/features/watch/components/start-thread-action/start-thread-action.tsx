import { Button } from '@kit/ui';
import { useState } from 'react';
import { usePlayerSeek, usePlayerTime } from '#app/components/player/taitube-player';
import { EngagementBar } from '#app/components/watch/engagement-bar';
import { useThreadSearch } from '#app/features/watch/hooks/use-thread-search';
import { useTimeLabel } from '#app/features/watch/hooks/use-time-label';
import { useRequireAccount } from '#app/hooks/use-require-account';
import { useT } from '#app/lib/messages';
import { LazyThreadFormDialog } from '../thread-form-dialog/thread-form-dialog.lazy';

const MS_PER_SECOND = 1000;

export interface StartThreadActionProps {
  videoId: string;
  /** `pill` is the engagement bar's action; `link` sits under the comment composer. */
  variant: 'pill' | 'link';
}

/** "Start a thread at m:ss", the playhead's moment, and the form it opens; the new thread then opens in its panel. */
export function StartThreadAction({ videoId, variant }: StartThreadActionProps) {
  const { currentTime } = usePlayerSeek();
  const seconds = usePlayerTime((time) => Math.floor(time));
  const { tOr } = useT();
  const timeLabel = useTimeLabel();
  const { run } = useRequireAccount('comment');
  const { open: openThread } = useThreadSearch(videoId);
  const [form, setForm] = useState<{ anchorMs: number; open: boolean }>();

  const label = tOr('threads.startAt', { time: timeLabel(seconds * MS_PER_SECOND) }, '');
  const start = () =>
    run(() => setForm({ anchorMs: Math.floor(currentTime() * MS_PER_SECOND), open: true }));

  return (
    <>
      {variant === 'pill' ? (
        <EngagementBar.Action icon="chat" onClick={start}>
          {label}
        </EngagementBar.Action>
      ) : (
        <Button variant="ghost" size="sm" className="self-start" onClick={start}>
          {label}
        </Button>
      )}
      {form && (
        <LazyThreadFormDialog
          videoId={videoId}
          anchorMs={form.anchorMs}
          open={form.open}
          onOpenChange={(open) => setForm({ ...form, open })}
          onStarted={({ id }) => openThread(id)}
        />
      )}
    </>
  );
}
