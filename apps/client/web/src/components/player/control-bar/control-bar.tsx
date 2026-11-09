import { videoDuration } from '@vp/intl';
import { Format, useFormat, useT } from '@vp/intl-react';
import { unwrapOr } from '@vp/result';
import { Badge, IconButton } from '@vp/ui';
import {
  Maximize,
  Minimize,
  Pause,
  Play,
  RectangleHorizontal,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { type ChangeEvent, type CSSProperties, useRef } from 'react';
import {
  LiveEdgeButton,
  usePlayerCommands,
  usePlayerState,
} from '#app/integrations/video-js/video-js-engine';
import { useOfferedPlayerChannel, usePlayerTheater } from '#app/lib/player/player-channel';
import type { PlaybackRange } from '#app/lib/player/taitube-player-props';
import { CaptionsButton } from './components/captions-button/captions-button';
import { SettingsMenu } from './components/settings-menu/settings-menu';
import { fromClipTime, toClipPlayhead } from './utils/clip-playhead';

export interface ControlBarProps {
  /** Shown over the top of the picture, on its own scrim, while the controls are. */
  title?: string;
  live?: boolean;
  /** A clip: the seek bar and the clock show only this range of the video. */
  range?: PlaybackRange;
  onPrevious?: () => void;
  onNext?: () => void;
}

export function ControlBar({ title, live = false, range, onPrevious, onNext }: ControlBarProps) {
  const visible = usePlayerState((state) => state.controlsVisible);

  const { tOr } = useT();

  return (
    <>
      {title && <TitleScrim title={title} visible={visible} />}
      <fieldset
        aria-label={tOr('player.controls', {}, '')}
        data-media-controls=""
        data-visible={visible || undefined}
        className="absolute inset-x-0 bottom-0 m-0 min-w-0 border-0 bg-linear-to-t from-media/90 via-media/55 to-transparent px-3 pt-20 pb-1 transition-opacity duration-fast ease-standard motion-reduce:transition-none not-data-visible:pointer-events-none not-data-visible:opacity-0 has-focus-visible:pointer-events-auto has-focus-visible:opacity-100"
      >
        {!live && <SeekBar range={range} />}
        <div className="flex items-center gap-1">
          {onPrevious && (
            <IconButton aria-label={tOr('player.previousVideo', {}, '')} onClick={onPrevious}>
              <SkipBack aria-hidden="true" />
            </IconButton>
          )}
          <PlayButton />
          {onNext && (
            <IconButton aria-label={tOr('player.nextVideo', {}, '')} onClick={onNext}>
              <SkipForward aria-hidden="true" />
            </IconButton>
          )}
          <VolumeControl />
          {live ? <LiveBadge /> : <ElapsedTime range={range} />}
          <div className="ms-auto flex items-center gap-1">
            <CaptionsButton />
            <SettingsMenu />
            <TheaterButton />
            <FullscreenButton />
          </div>
        </div>
      </fieldset>
    </>
  );
}

function TitleScrim({ title, visible }: Readonly<{ title: string; visible: boolean }>) {
  return (
    <div
      aria-hidden="true"
      data-media-controls=""
      data-visible={visible || undefined}
      className="pointer-events-none absolute inset-x-0 top-0 bg-linear-to-b from-media/80 via-media/40 to-transparent px-3 pt-2 pb-10 transition-opacity duration-fast ease-standard motion-reduce:transition-none not-data-visible:opacity-0"
    >
      <p className="m-0 truncate text-title select-text">{title}</p>
    </div>
  );
}

function useClipPlayhead(range: PlaybackRange | undefined) {
  const currentTime = usePlayerState((state) => state.currentTime);
  const duration = usePlayerState((state) => state.duration);

  return toClipPlayhead(range, { currentTime, duration });
}

const percentOf = (part: number, whole: number) =>
  `${whole > 0 ? Math.min((part / whole) * 100, 100) : 0}%`;

function SeekBar({ range }: Pick<ControlBarProps, 'range'>) {
  const { currentTime, duration } = useClipPlayhead(range);
  const videoDurationSeconds = usePlayerState((state) => state.duration);
  const bufferedEnd = usePlayerState((state) => state.bufferedEnd);
  const { currentTime: buffered } = toClipPlayhead(range, {
    currentTime: bufferedEnd,
    duration: videoDurationSeconds,
  });

  const { seek } = usePlayerCommands();
  const { tOr } = useT();
  const { format } = useFormat();

  return (
    <input
      type="range"
      aria-label={tOr('player.seek', {}, '')}
      aria-valuetext={unwrapOr(format(videoDuration(currentTime)), '')}
      min={0}
      max={duration}
      step="any"
      value={currentTime}
      onChange={({ currentTarget }) =>
        seek(fromClipTime(range, currentTarget.valueAsNumber, videoDurationSeconds))
      }
      style={
        {
          '--played': percentOf(currentTime, duration),
          '--buffered': percentOf(buffered, duration),
        } as CSSProperties
      }
      className="media-seek block w-full cursor-pointer"
    />
  );
}

function LiveBadge() {
  const { tOr } = useT();

  return (
    <LiveEdgeButton
      label={(atLiveEdge) =>
        atLiveEdge ? tOr('player.live', {}, '') : tOr('player.goToLive', {}, '')
      }
    >
      {(atLiveEdge) => (
        <Badge variant={atLiveEdge ? 'solid' : 'scrim'} tone={atLiveEdge ? 'live' : 'neutral'}>
          {tOr('player.live', {}, '')}
        </Badge>
      )}
    </LiveEdgeButton>
  );
}

function PlayButton() {
  const paused = usePlayerState((state) => state.paused);

  const { play, pause } = usePlayerCommands();
  const { tOr } = useT();

  if (paused) {
    return (
      <IconButton aria-label={tOr('player.play', {}, '')} onClick={play}>
        <Play aria-hidden="true" />
      </IconButton>
    );
  }

  return (
    <IconButton aria-label={tOr('player.pause', {}, '')} onClick={pause}>
      <Pause aria-hidden="true" />
    </IconButton>
  );
}

function VolumeControl() {
  const volume = usePlayerState((state) => state.volume);
  const muted = usePlayerState((state) => state.muted);

  const { setVolume, setMuted } = usePlayerCommands();
  const { tOr } = useT();

  // Loudness is heard on a log scale, so the slider moves the square root of the gain.
  const position = muted ? 0 : Math.sqrt(volume);
  const lastAudible = useRef(1);

  const handleSlide = ({ currentTarget: { valueAsNumber } }: ChangeEvent<HTMLInputElement>) => {
    if (valueAsNumber > 0) lastAudible.current = valueAsNumber ** 2;
    setVolume(valueAsNumber ** 2);
    setMuted(valueAsNumber === 0);
  };

  const handleToggleMute = () => {
    if (muted && volume === 0) setVolume(lastAudible.current);
    setMuted(!muted);
  };

  return (
    <div className="group/volume flex items-center">
      <IconButton
        aria-label={muted ? tOr('player.unmute', {}, '') : tOr('player.mute', {}, '')}
        onClick={handleToggleMute}
      >
        <VolumeIcon position={position} />
      </IconButton>
      <input
        type="range"
        aria-label={tOr('player.volume', {}, '')}
        min={0}
        max={1}
        step={0.01}
        value={position}
        onChange={handleSlide}
        className="w-0 cursor-pointer opacity-0 accent-fg transition-[width,opacity] duration-fast ease-standard group-focus-within/volume:w-20 group-focus-within/volume:opacity-100 group-hover/volume:w-20 group-hover/volume:opacity-100 motion-reduce:transition-none"
      />
    </div>
  );
}

function VolumeIcon({ position }: { position: number }) {
  if (position === 0) {
    return <VolumeX aria-hidden="true" />;
  }

  if (position < 0.5) {
    return <Volume1 aria-hidden="true" />;
  }

  return <Volume2 aria-hidden="true" />;
}

function ElapsedTime({ range }: Pick<ControlBarProps, 'range'>) {
  const { currentTime, duration } = useClipPlayhead(range);

  return (
    <span className="px-2 text-label whitespace-nowrap tabular-nums">
      <Format value={videoDuration(currentTime)} /> / <Format value={videoDuration(duration)} />
    </span>
  );
}

function FullscreenButton() {
  const canFullscreen = usePlayerState((state) => state.canFullscreen);
  const fullscreen = usePlayerState((state) => state.fullscreen);

  const { requestFullscreen, exitFullscreen } = usePlayerCommands();
  const { tOr } = useT();

  if (!canFullscreen) {
    return null;
  }

  if (fullscreen) {
    return (
      <IconButton aria-label={tOr('player.exitFullscreen', {}, '')} onClick={exitFullscreen}>
        <Minimize aria-hidden="true" />
      </IconButton>
    );
  }

  return (
    <IconButton aria-label={tOr('player.fullscreen', {}, '')} onClick={requestFullscreen}>
      <Maximize aria-hidden="true" />
    </IconButton>
  );
}

function TheaterButton() {
  const channel = useOfferedPlayerChannel();
  const theater = usePlayerTheater();
  const { tOr } = useT();

  if (!channel) {
    return null;
  }

  return (
    <IconButton
      aria-label={theater ? tOr('player.exitTheater', {}, '') : tOr('player.theater', {}, '')}
      aria-pressed={theater}
      onClick={channel.toggleTheater}
    >
      <RectangleHorizontal aria-hidden="true" />
    </IconButton>
  );
}
