import { VideoCard, type VideoCardVariant } from '@kit/components';
import { Format } from '@kit/intl-react';
import { assertNever } from '@kit/result';
import { Avatar, Badge, Card } from '@kit/ui';
import { Link } from '@tanstack/react-router';
import type { PageItemView, ResolvedSectionView } from '@vp/api-contracts';
import { publishedAt } from '@vp/intl-formats';
import { PlaylistCover } from '#app/components/playlist/playlist-cover';
import { useDurationText } from '#app/hooks/use-duration-text';
import { useT } from '#app/lib/messages';

type Presentation = ResolvedSectionView['presentation'];
type VideoItem = Extract<PageItemView, { kind: 'video' }>;
type LiveItem = Extract<PageItemView, { kind: 'live' }>;

const LIVE_CARD_STATE: Readonly<Record<LiveItem['status'], 'live' | 'rest'>> = {
  IDLE: 'rest',
  LIVE: 'live',
  ENDED: 'rest',
};

export interface PageItemCardProps {
  item: PageItemView;
  /** How a video is drawn in the section's layout. */
  variant: VideoCardVariant;
  density: Presentation['density'];
  show: Presentation['show'];
}

function PageVideoCard({ item, variant, density, show }: PageItemCardProps & { item: VideoItem }) {
  const { tOr } = useT();
  const { clock, spoken } = useDurationText(item.durationMs ?? undefined);
  const short = item.format === 'short';

  return (
    <VideoCard.Root
      variant={short && variant === 'shelf' ? 'poster' : variant}
      size={density === 'compact' ? 'sm' : 'md'}
      expandOnHover={false}
    >
      <VideoCard.Thumb
        src={item.thumbnailUrl ?? undefined}
        alt=""
        duration={show.duration ? clock : undefined}
        spokenDuration={show.duration ? spoken : undefined}
      />
      <VideoCard.Title asChild>
        {short ? (
          <Link to="/shorts/$videoId" params={{ videoId: item.id }}>
            {item.title}
          </Link>
        ) : (
          <Link to="/watch/$videoId" params={{ videoId: item.id }}>
            {item.title}
          </Link>
        )}
      </VideoCard.Title>
      {(show.views || show.date) && (
        <VideoCard.Meta>
          {show.views && tOr('videos.views', { count: item.viewsCount }, '')}
          {show.views && show.date && ' · '}
          {show.date && (
            <time dateTime={item.createdAt}>
              <Format value={publishedAt(item.createdAt).relative} />
            </time>
          )}
        </VideoCard.Meta>
      )}
    </VideoCard.Root>
  );
}

/** One card of a section, by what it points at: a video through the kit's card, a post, a playlist, a stream or a channel as a tile. */
export function PageItemCard(props: PageItemCardProps) {
  const { item, show } = props;
  const { tOr } = useT();

  switch (item.kind) {
    case 'video':
      return <PageVideoCard {...props} item={item} />;
    case 'post':
      return (
        <Card.Root asChild variant="solid">
          <article className="relative flex flex-col gap-inline p-inset-card">
            <Badge size="sm" tone="neutral" className="self-start">
              {tOr('channelPage.postTile', {}, '')}
            </Badge>
            <Link
              to="/post/$id"
              params={{ id: item.id }}
              className="line-clamp-4 text-body text-fg no-underline after:absolute after:inset-0 after:content-[''] focus-ring"
            >
              {item.title}
            </Link>
            <p className="m-0 text-caption text-fg-muted">
              {tOr('posts.likeCount', { count: item.likesCount }, '')}
              {' · '}
              {tOr('posts.replyCount', { count: item.commentsCount }, '')}
            </p>
          </article>
        </Card.Root>
      );
    case 'playlist':
      return (
        <article className="relative flex flex-col gap-inline">
          <PlaylistCover images={item.thumbnailUrl ? [item.thumbnailUrl] : []} />
          <Link
            to="/playlist"
            search={{ list: item.id }}
            className="text-label text-fg no-underline after:absolute after:inset-0 after:content-[''] focus-ring"
          >
            {item.title}
          </Link>
          <p className="m-0 text-caption text-fg-muted">
            {tOr('channelPage.playlistVideos', { count: item.itemCount }, '')}
          </p>
        </article>
      );
    case 'live':
      return (
        <article className="relative flex flex-col gap-inline">
          <VideoCard.Root
            variant="shelf"
            expandOnHover={false}
            state={LIVE_CARD_STATE[item.status]}
          >
            <VideoCard.Thumb src={item.thumbnailUrl ?? undefined} alt="" />
            <VideoCard.Title asChild>
              {item.videoId ? (
                <Link to="/watch/$videoId" params={{ videoId: item.videoId }}>
                  {item.title}
                </Link>
              ) : (
                <Link to="/live/$streamId" params={{ streamId: item.id }}>
                  {item.title}
                </Link>
              )}
            </VideoCard.Title>
            <VideoCard.Meta>
              {tOr('channelPage.liveStatus', { status: item.status }, '')}
              {show.views && LIVE_CARD_STATE[item.status] === 'live' && (
                <>
                  {' · '}
                  {tOr('channelPage.liveViewers', { count: item.viewers }, '')}
                </>
              )}
            </VideoCard.Meta>
          </VideoCard.Root>
        </article>
      );
    case 'channel':
      return (
        <article className="relative flex flex-col items-center gap-inline text-center">
          <Avatar.Root size="lg">
            {item.channel.avatarUrl && <Avatar.Image src={item.channel.avatarUrl} alt="" />}
            <Avatar.Fallback aria-hidden="true">
              {item.channel.displayName.slice(0, 1)}
            </Avatar.Fallback>
          </Avatar.Root>
          <Link
            to="/channels/$handle"
            params={{ handle: item.channel.handle }}
            search={{ preview: undefined, as: undefined }}
            className="text-label text-fg no-underline after:absolute after:inset-0 after:content-[''] focus-ring"
          >
            {item.channel.displayName}
          </Link>
        </article>
      );
    default:
      return assertNever(item, 'PageItem');
  }
}
