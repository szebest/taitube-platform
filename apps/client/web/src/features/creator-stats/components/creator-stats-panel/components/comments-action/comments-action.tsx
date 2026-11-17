import { useT } from '@kit/intl-react';
import { Switch } from '@kit/ui';
import type { Video } from '@vp/api-contracts';
import { useFailureToast } from '@vp/queries';
import { useUpdateVideo } from '#app/features/creator-stats/hooks/use-update-video';

/** Comments on or off for the video, over the studio's `commentsEnabled`. */
export function CommentsAction({ video }: { video: Video }) {
  const { tOr } = useT();
  const showFailure = useFailureToast();
  const update = useUpdateVideo(video);

  return (
    <label className="flex items-center gap-inline text-label">
      <Switch
        checked={video.commentsEnabled}
        disabled={update.isPending}
        onCheckedChange={(commentsEnabled) =>
          update.mutate(
            { commentsEnabled },
            { onError: (error) => showFailure(tOr('creatorStats.saveFailed', {}, ''), error) }
          )
        }
      />
      {tOr('creatorStats.commentsOn', {}, '')}
    </label>
  );
}
