import { useFormat } from '@kit/intl-react';
import { unwrapOr } from '@kit/result';
import { cn, Icon } from '@kit/ui';
import { Link } from '@tanstack/react-router';
import { useT } from '#app/lib/messages';

const MS_PER_SECOND = 1000;

export type PostShare =
  | {
      type: 'video';
      id: string;
      title: string;
      thumbnailUrl: string | null;
      durationSeconds: number | null;
    }
  | { type: 'playlist'; id: string; title: string; itemCount: number }
  | { type: 'unavailable' };

export interface PostCardShareCardProps {
  share: PostShare;
  /** Where in a shared video the card opens it, in milliseconds. */
  startMs?: number | null;
  /** Called on each click on the card. */
  onOpen?: () => void;
  className?: string;
}

const FRAME =
  'flex items-center gap-stack overflow-hidden rounded-card border-divider border-border bg-surface p-inset-control text-fg no-underline';

interface ShareDetailsProps {
  share: Exclude<PostShare, { type: 'unavailable' }>;
  startMs: number | null;
}

function ShareDetails({ share, startMs }: ShareDetailsProps) {
  const { tOr } = useT();
  const { format } = useFormat();
  const clock = (seconds: number) => unwrapOr(format({ type: 'duration', value: seconds }), '');
  const length =
    share.type === 'video'
      ? share.durationSeconds !== null && clock(share.durationSeconds)
      : tOr('posts.sharePlaylistItems', { count: share.itemCount }, '');
  const startsAt =
    share.type === 'video' && startMs
      ? tOr('posts.shareStartsAt', { time: clock(startMs / MS_PER_SECOND) }, '')
      : '';

  return (
    <>
      {share.type === 'video' && share.thumbnailUrl ? (
        <img
          src={share.thumbnailUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="aspect-video w-32 shrink-0 rounded-chip object-cover"
        />
      ) : (
        <Icon name={share.type === 'video' ? 'video' : 'playlist'} size="lg" />
      )}
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-caption text-fg-muted">
          {share.type === 'video'
            ? tOr('posts.shareVideo', {}, '')
            : tOr('posts.sharePlaylist', {}, '')}
        </span>
        <span className="line-clamp-2 text-label">{share.title}</span>
        <span className="text-caption text-fg-muted">
          {[length, startsAt].filter(Boolean).join(' · ')}
        </span>
      </span>
    </>
  );
}

/** The video or playlist a post shares, as a link, or the word Unavailable and nothing of it once it is gone or private. */
export function PostCardShareCard({
  share,
  startMs = null,
  onOpen,
  className,
}: PostCardShareCardProps) {
  const { tOr } = useT();

  switch (share.type) {
    case 'video':
      return (
        <Link
          data-slot="post-card-share"
          to="/watch/$videoId"
          params={{ videoId: share.id }}
          search={startMs ? { t: Math.floor(startMs / MS_PER_SECOND) } : {}}
          onClick={onOpen}
          className={cn(FRAME, 'focus-ring', className)}
        >
          <ShareDetails share={share} startMs={startMs} />
        </Link>
      );
    case 'playlist':
      return (
        <Link
          data-slot="post-card-share"
          to="/playlist"
          search={{ list: share.id }}
          onClick={onOpen}
          className={cn(FRAME, 'focus-ring', className)}
        >
          <ShareDetails share={share} startMs={startMs} />
        </Link>
      );
    case 'unavailable':
      return (
        <div data-slot="post-card-share" data-state="unavailable" className={cn(FRAME, className)}>
          <Icon name="lock" />
          <span className="text-body text-fg-muted">{tOr('posts.shareUnavailable', {}, '')}</span>
        </div>
      );
  }
}
