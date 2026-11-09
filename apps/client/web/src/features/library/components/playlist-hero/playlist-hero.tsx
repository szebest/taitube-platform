import { Link, useNavigate, useRouter } from '@tanstack/react-router';
import type { PlaylistView } from '@vp/api-contracts';
import { VideoThumbnail } from '@vp/components';
import { useT } from '@vp/intl-react';
import { Button, Icon } from '@vp/ui';
import { useState } from 'react';
import { useCopyLink } from '#app/hooks/use-copy-link';
import { useDurationText } from '#app/hooks/use-duration-text';
import { usePlaybackQueue } from '#app/hooks/use-playback-queue';
import { urlModals } from '#app/lib/url-modal/registry';
import { PlaylistDetailsForm } from '../playlist-details-form/playlist-details-form';

const STACK_DEPTH = 3;

export interface PlaylistHeroProps {
  playlist: PlaylistView;
  /** The owner's controls: edit the details, change privacy, delete. */
  editable: boolean;
}

function totalDurationMs(playlist: PlaylistView): number {
  return playlist.items.reduce((total, { video }) => total + (video.durationMs ?? 0), 0);
}

/** The playlist's cover and summary, with Play all, Shuffle and Share; the owner also gets the edit and delete controls. */
export function PlaylistHero({ playlist, editable }: PlaylistHeroProps) {
  const { tOr } = useT();
  const router = useRouter();
  const navigate = useNavigate();
  const copyLink = useCopyLink();
  const { repeat, setModes } = usePlaybackQueue();
  const { open } = urlModals.useUrlModal('delete-playlist');
  const [editing, setEditing] = useState(false);
  const { spoken } = useDurationText(totalDurationMs(playlist));

  const { id, title, description, visibility, owner, items } = playlist;
  const cover = items.slice(0, STACK_DEPTH);
  const empty = items.length === 0;

  const play = (index: number, shuffle: boolean) => {
    setModes({ shuffle, repeat });
    return navigate({
      to: '/watch/$videoId',
      params: { videoId: items[index]?.videoId ?? '' },
      search: { list: id, index },
    });
  };

  const share = () => {
    const { href } = router.buildLocation({ to: '/playlist', search: { list: id } });
    return copyLink(new URL(href, window.location.origin).toString());
  };

  return (
    <header className="flex flex-col gap-stack expanded:flex-row">
      <div aria-hidden="true" className="relative aspect-video w-full max-w-96 shrink-0">
        {cover.map(({ id: itemId, video }, depth) => (
          <VideoThumbnail.Root
            key={itemId}
            className="absolute inset-x-0 bottom-0 w-full"
            style={{
              transform: `translateY(${-depth * 0.75}rem) scale(${1 - depth * 0.05})`,
              zIndex: STACK_DEPTH - depth,
            }}
          >
            <VideoThumbnail.Image src={video.thumbnailUrl ?? video.posterUrl} />
          </VideoThumbnail.Root>
        ))}
        {empty && (
          <VideoThumbnail.Root className="w-full">
            <VideoThumbnail.Image src={playlist.thumbnailUrl ?? undefined} />
          </VideoThumbnail.Root>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-stack">
        {editing ? (
          <PlaylistDetailsForm playlist={playlist} onDone={() => setEditing(false)} />
        ) : (
          <>
            <h1 className="m-0 text-headline">{title}</h1>
            {owner && (
              <Link
                to="/channel/$channelId"
                params={{ channelId: owner.id }}
                className="text-label"
              >
                {tOr('library.playlistOwner', { name: owner.displayName }, '')}
              </Link>
            )}
            <p className="m-0 text-caption text-fg-muted">
              {tOr(
                'library.playlistDuration',
                { count: playlist.videoCount, duration: spoken ?? '' },
                ''
              )}
              {' · '}
              {tOr('videos.visibility', { visibility }, '')}
            </p>
            {description && <p className="m-0 whitespace-pre-line text-body">{description}</p>}
          </>
        )}
        <div className="flex flex-wrap gap-inline">
          {!empty && (
            <>
              <Button variant="solid" tone="accent" onClick={() => play(0, false)}>
                <Icon name="play" />
                {tOr('library.playOrder', { mode: 'play' }, '')}
              </Button>
              <Button
                variant="soft"
                onClick={() => play(Math.floor(Math.random() * items.length), true)}
              >
                <Icon name="shuffle" />
                {tOr('library.playOrder', { mode: 'shuffle' }, '')}
              </Button>
            </>
          )}
          <Button variant="soft" onClick={share}>
            <Icon name="share" />
            {tOr('library.sharePlaylist', {}, '')}
          </Button>
          {editable && !editing && (
            <>
              <Button variant="ghost" onClick={() => setEditing(true)}>
                <Icon name="edit" />
                {tOr('library.editPlaylist', {}, '')}
              </Button>
              <Button variant="ghost" tone="danger" onClick={() => open({ playlistId: id })}>
                <Icon name="trash" />
                {tOr('library.deletePlaylist', {}, '')}
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
