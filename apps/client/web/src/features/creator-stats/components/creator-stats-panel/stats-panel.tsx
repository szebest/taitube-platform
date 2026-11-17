import { useT } from '@kit/intl-react';
import { Button, Icon, IconButton, useMediaQuery } from '@kit/ui';
import { useQuery } from '@tanstack/react-query';
import type { Video } from '@vp/api-contracts';
import { SectionError, StatCardSkeleton } from '@vp/components';
import { canPinComment, canUpdateVideo } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { creatorStatsQueryOptions, useApi } from '@vp/queries';
import { useId, useState } from 'react';
import { useReducedMotion } from '#app/hooks/use-reduced-motion';
import { STUDIO_URL } from '#app/lib/config';
import { CommentsAction } from './components/comments-action/comments-action';
import { EditTitleAction } from './components/edit-title-action/edit-title-action';
import { PinCommentAction } from './components/pin-comment-action/pin-comment-action';
import { StatsCards } from './components/stats-cards/stats-cards';
import { StatsChart } from './components/stats-chart/stats-chart';
import { StatsRetention } from './components/stats-retention/stats-retention';
import { ThumbnailAction } from './components/thumbnail-action/thumbnail-action';

const MEDIUM_AND_UP = '(min-width: 600px)';
const SKELETON_CARDS = ['views', 'watch', 'duration', 'likes', 'comments', 'subscribers'];

export function StatsPanel({ video }: { video: Video }) {
  const api = useApi();
  const { tOr } = useT();
  const bodyId = useId();
  const roomy = useMediaQuery(MEDIUM_AND_UP);
  const reducedMotion = useReducedMotion();
  const [chosen, setChosen] = useState<boolean>();
  const stats = useQuery(creatorStatsQueryOptions(api, video.id));
  const canEdit = useCan(canUpdateVideo, { video });
  const canPin = useCan(canPinComment, { videoOwnerId: video.ownerId });
  const expanded = chosen ?? roomy;
  const live = stats.data?.first48Hours != null;

  return (
    <section
      data-slot="creator-stats-panel"
      aria-label={tOr('creatorStats.region', {}, '')}
      className="flex flex-col gap-stack rounded-card border-divider border-border bg-surface p-inset-card"
    >
      <header className="flex items-center gap-inline">
        <Icon name="lock" size="sm" />
        <p className="m-0 flex-1 text-label">{tOr('creatorStats.private', {}, '')}</p>
        {live && (
          <span className="flex items-center gap-1 text-label text-fg-muted">
            <span
              aria-hidden="true"
              className={`size-2 rounded-full bg-success ${reducedMotion ? '' : 'motion-safe:animate-pulse'}`}
            />
            {tOr('creatorStats.live', {}, '')}
          </span>
        )}
        <IconButton
          size="sm"
          aria-expanded={expanded}
          aria-controls={bodyId}
          aria-label={tOr(expanded ? 'creatorStats.collapse' : 'creatorStats.expand', {}, '')}
          onClick={() => setChosen(!expanded)}
        >
          <Icon name="chevron-down" className={expanded ? 'rotate-180' : undefined} />
        </IconButton>
      </header>
      <div id={bodyId} hidden={!expanded} className="flex flex-col gap-stack">
        {stats.isPending && (
          <div
            data-slot="creator-stats-skeleton"
            className="grid grid-cols-2 gap-inline medium:grid-cols-3"
          >
            {SKELETON_CARDS.map((card) => (
              <StatCardSkeleton key={card} />
            ))}
          </div>
        )}
        {stats.isError && (
          <SectionError.Root
            role="alert"
            retrying={stats.isFetching}
            onRetry={() => void stats.refetch()}
          >
            <SectionError.Message>{tOr('creatorStats.loadFailed', {}, '')}</SectionError.Message>
          </SectionError.Root>
        )}
        {stats.data && (
          <>
            <StatsCards stats={stats.data} />
            <StatsChart stats={stats.data} />
            <StatsRetention videoId={video.id} stats={stats.data} />
            <Button asChild variant="soft" size="sm" className="self-start">
              <a href={`${STUDIO_URL}/videos/${video.id}/analytics`}>
                {tOr('creatorStats.openAnalytics', {}, '')}
              </a>
            </Button>
          </>
        )}
        {(canEdit || canPin) && (
          <div
            role="group"
            aria-label={tOr('creatorStats.actions', {}, '')}
            className="flex flex-wrap items-center gap-inline"
          >
            {canEdit && (
              <>
                <EditTitleAction video={video} />
                <ThumbnailAction video={video} />
                <CommentsAction video={video} />
              </>
            )}
            {canPin && <PinCommentAction videoId={video.id} />}
          </div>
        )}
      </div>
    </section>
  );
}
