import { useSuspenseQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { canDeleteClip } from '@vp/permissions';
import { Can } from '@vp/permissions-react';
import { clipQueryOptions, useApi } from '@vp/queries';
import { Button } from '@vp/ui';

import { PlayerChannelProvider } from '#app/features/player';
import { WatchLayout } from '#app/features/watch/components/watch-layout';
import { WatchStage } from '#app/features/watch/components/watch-stage';

import { ClipDelete } from './clip-delete';

const MS_PER_SECOND = 1000;

/** `/clip/$clipId`: the watch page in clip mode, the player looping the clip's range and a way back to the whole video. */
export function ClipPage() {
  const { clipId } = useParams({ from: '/clip/$clipId' });
  const api = useApi();
  const { tOr } = useT();
  const { data: clip } = useSuspenseQuery(clipQueryOptions(api, clipId));

  return (
    <PlayerChannelProvider>
      <WatchLayout
        stage={
          <WatchStage video={clip.video} range={{ startMs: clip.startMs, endMs: clip.endMs }} />
        }
        details={
          <>
            <h1 className="tw:m-0 tw:text-title-lg tw:large:text-headline">{clip.title}</h1>
            <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-inline">
              <Button asChild variant="solid" tone="accent">
                <Link
                  to="/watch/$videoId"
                  params={{ videoId: clip.videoId }}
                  search={{ t: Math.floor(clip.startMs / MS_PER_SECOND) }}
                >
                  {tOr('clips.fullVideo', {}, '')}
                </Link>
              </Button>
              <Can type="rule" I={canDeleteClip} this={{ clip: { userId: clip.userId } }}>
                <ClipDelete clip={clip} />
              </Can>
            </div>
          </>
        }
      />
    </PlayerChannelProvider>
  );
}
