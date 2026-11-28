import { Button, Icon } from '@kit/ui';
import { useNavigate, useRouter } from '@tanstack/react-router';
import type { PlaylistView } from '@vp/api-contracts';
import { useState } from 'react';
import { WatchTogether } from '#app/components/party/watch-together';
import { PlaylistCover } from '#app/components/playlist/playlist-cover';
import { usePlaylistAbilities } from '#app/features/library/hooks/use-playlist-abilities';
import { coverImages } from '#app/features/library/utils/cover-images';
import { useCopyLink } from '#app/hooks/use-copy-link';
import { usePlaybackQueue } from '#app/hooks/use-playback-queue';
import { useT } from '#app/lib/messages';
import { PlaylistDetailsForm } from '../playlist-details-form/playlist-details-form';
import { PlaylistDialogs } from '../playlist-dialogs/playlist-dialogs';
import { PlaylistHeroActions } from './components/playlist-hero-actions/playlist-hero-actions';
import { PlaylistHeroSummary } from './components/playlist-hero-summary/playlist-hero-summary';
import { PlaylistMoreMenu } from './components/playlist-more-menu/playlist-more-menu';

export interface PlaylistHeroProps {
  playlist: PlaylistView;
  /** Whoever may retitle and redescribe it: the owner and its editors. */
  editable: boolean;
}

/**
 * The playlist's cover and summary, with Play all, Shuffle, Share, Follow, Fork and Pin, and a menu
 * of everything else the viewer may do with it.
 */
export function PlaylistHero({ playlist, editable }: PlaylistHeroProps) {
  const [editing, setEditing] = useState(false);
  const { tOr } = useT();
  const router = useRouter();
  const navigate = useNavigate();
  const copyLink = useCopyLink();
  const { repeat, setModes } = usePlaybackQueue();
  const abilities = usePlaylistAbilities(playlist);

  const { id, items, nextEpisodeVideoId } = playlist;
  const continueIndex = items.findIndex(({ videoId }) => videoId === nextEpisodeVideoId);
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
      <PlaylistCover images={coverImages(playlist)} className="max-w-96 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-stack">
        {editing ? (
          <PlaylistDetailsForm playlist={playlist} onDone={() => setEditing(false)} />
        ) : (
          <PlaylistHeroSummary playlist={playlist} seesCollaborators={abilities.seeCollaborators} />
        )}
        <div className="flex flex-wrap gap-inline">
          {continueIndex >= 0 && (
            <Button variant="solid" tone="accent" onClick={() => play(continueIndex, false)}>
              <Icon name="play" />
              {tOr('library.continueSeries', {}, '')}
            </Button>
          )}
          {!empty && (
            <>
              <Button
                variant={continueIndex >= 0 ? 'soft' : 'solid'}
                tone={continueIndex >= 0 ? 'neutral' : 'accent'}
                onClick={() => play(0, false)}
              >
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
              <WatchTogether.Root source={() => ({ kind: 'playlist', playlistId: id })}>
                <WatchTogether.Trigger>
                  <Button variant="soft">
                    <Icon name="party" />
                    {tOr('party.watchTogether', {}, '')}
                  </Button>
                </WatchTogether.Trigger>
              </WatchTogether.Root>
            </>
          )}
          <Button variant="soft" onClick={share}>
            <Icon name="share" />
            {tOr('library.sharePlaylist', {}, '')}
          </Button>
          <PlaylistHeroActions playlist={playlist} abilities={abilities} />
          <PlaylistMoreMenu
            playlist={playlist}
            abilities={abilities}
            onEdit={editable && !editing ? () => setEditing(true) : undefined}
          />
        </div>
      </div>
      <PlaylistDialogs playlist={playlist} abilities={abilities} />
    </header>
  );
}
