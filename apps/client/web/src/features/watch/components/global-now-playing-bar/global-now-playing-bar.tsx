import { Link, useNavigate } from '@tanstack/react-router';
import type { VideoSummary } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { Icon, IconButton, useUiCopy } from '@vp/ui';
import { PictureInPicture2 } from 'lucide-react';
import {
  usePlayerPictureInPicture,
  usePlayerSeek,
  usePlayerTime,
} from '#app/components/player/taitube-player';
import { NowPlayingBar } from '#app/components/shell/now-playing-bar';
import { useAutoplayNext } from '#app/features/watch/hooks/use-autoplay-next';
import { useIsWatching } from '#app/features/watch/hooks/use-is-watching';
import { useQueueNavigation } from '#app/features/watch/hooks/use-queue-navigation';
import { useDurationText } from '#app/hooks/use-duration-text';
import { usePlaybackQueue } from '#app/hooks/use-playback-queue';
import { PlayerSlot } from '../player-slot/player-slot';

const MS_PER_SECOND = 1000;
const SEEK_STEP_SECONDS = 5;

/** The bar that keeps the video playing off the watch page: its picture is the one player, moved here. */
export function GlobalNowPlayingBar() {
  const watching = useIsWatching();
  const { current } = usePlaybackQueue();

  if (watching || !current) {
    return null;
  }

  return <NowPlayingBarFor video={current.video} />;
}

function NowPlayingBarFor({ video }: { video: VideoSummary }) {
  const { tOr } = useT();
  const { close: closeLabel } = useUiCopy();
  const navigate = useNavigate();
  const seeker = usePlayerSeek();
  const pictureInPicture = usePlayerPictureInPicture();
  const seconds = usePlayerTime(Math.floor);
  const { videos, playlistId, paused, setPaused, close } = usePlaybackQueue();
  const { next, previous, hasNext, hasPrevious } = useQueueNavigation();
  const total = (video.durationMs ?? 0) / MS_PER_SECOND;
  const { clock: playedClock, spoken: playedSpoken } = useDurationText(seconds * MS_PER_SECOND);
  const { clock: totalClock, spoken: totalSpoken } = useDurationText(video.durationMs);

  useAutoplayNext();

  const position = videos.findIndex(({ id }) => id === video.id);
  const search = playlistId && position >= 0 ? { list: playlistId, index: position } : {};
  const status = video.playbackUrl ? 'ready' : 'unavailable';
  const queuePosition =
    position >= 0
      ? tOr('watch.queuePosition', { position: position + 1, count: videos.length }, '')
      : undefined;

  return (
    <NowPlayingBar.Root
      playing={!paused}
      progress={total > 0 ? Math.min(1, seconds / total) : 0}
      status={status}
      onPlayPause={() => setPaused(!paused)}
      onSeek={(fraction) => seeker.seek(fraction * total)}
    >
      <NowPlayingBar.Progress
        valueText={tOr(
          'watch.nowPlayingProgress',
          { played: playedSpoken ?? '', total: totalSpoken ?? '' },
          ''
        )}
        step={total > 0 ? SEEK_STEP_SECONDS / total : undefined}
      />
      <NowPlayingBar.Expand asChild>
        <Link
          to="/watch/$videoId"
          params={{ videoId: video.id }}
          search={{ ...search, t: seconds }}
        />
      </NowPlayingBar.Expand>
      <NowPlayingBar.Media>
        <PlayerSlot />
      </NowPlayingBar.Media>
      <NowPlayingBar.Info>
        <NowPlayingBar.Title>{video.title ?? tOr('browse.untitled', {}, '')}</NowPlayingBar.Title>
        <NowPlayingBar.Subtitle>{video.channel?.displayName}</NowPlayingBar.Subtitle>
        <NowPlayingBar.Time>
          {playedClock} / {totalClock}
        </NowPlayingBar.Time>
      </NowPlayingBar.Info>
      <NowPlayingBar.Transport>
        <NowPlayingBar.Previous disabled={!hasPrevious} onClick={previous} />
        <NowPlayingBar.PlayPause />
        <NowPlayingBar.Next disabled={!hasNext} onClick={next} />
      </NowPlayingBar.Transport>
      <NowPlayingBar.Queue
        count={queuePosition}
        onClick={() => navigate({ to: '/watch/$videoId', params: { videoId: video.id }, search })}
      />
      {pictureInPicture.available && (
        <IconButton
          aria-label={tOr(
            pictureInPicture.active ? 'player.exitPictureInPicture' : 'player.pictureInPicture',
            {},
            ''
          )}
          aria-pressed={pictureInPicture.active}
          onClick={seeker.togglePictureInPicture}
        >
          <PictureInPicture2 aria-hidden="true" />
        </IconButton>
      )}
      <IconButton aria-label={closeLabel} onClick={close}>
        <Icon name="close" />
      </IconButton>
    </NowPlayingBar.Root>
  );
}
