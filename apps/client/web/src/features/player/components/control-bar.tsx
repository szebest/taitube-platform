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
import { type ChangeEvent, useRef } from 'react';
import { LiveEdgeButton, usePlayerCommands, usePlayerState } from '../engine/video-js-engine';
import { useOfferedPlayerChannel, usePlayerTheater } from '../player-channel';
import { CaptionsButton } from './captions-button';
import { SettingsMenu } from './settings-menu';

export interface ControlBarProps {
  live?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
}

export function ControlBar({ live = false, onPrevious, onNext }: ControlBarProps) {
  const visible = usePlayerState((state) => state.controlsVisible);

  const { tOr } = useT();

  return (
    <fieldset
      aria-label={tOr('player.controls', {}, '')}
      data-visible={visible || undefined}
      className="absolute inset-x-0 bottom-0 m-0 min-w-0 border-0 bg-linear-to-t from-scrim to-transparent px-3 pt-12 pb-1 transition-opacity duration-200 motion-reduce:transition-none not-data-visible:pointer-events-none not-data-visible:opacity-0 has-focus-visible:pointer-events-auto has-focus-visible:opacity-100"
    >
      {!live && <SeekBar />}
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
        {live ? <LiveBadge /> : <ElapsedTime />}
        <div className="ms-auto flex items-center gap-1">
          <CaptionsButton />
          <SettingsMenu />
          <TheaterButton />
          <FullscreenButton />
        </div>
      </div>
    </fieldset>
  );
}

function SeekBar() {
  const currentTime = usePlayerState((state) => state.currentTime);
  const duration = usePlayerState((state) => state.duration);

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
      onChange={({ currentTarget }) => seek(currentTarget.valueAsNumber)}
      className="block w-full cursor-pointer accent-accent"
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
        className="w-0 cursor-pointer opacity-0 accent-fg transition-all duration-200 group-focus-within/volume:w-20 group-focus-within/volume:opacity-100 group-hover/volume:w-20 group-hover/volume:opacity-100 motion-reduce:transition-none"
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

function ElapsedTime() {
  const currentTime = usePlayerState((state) => state.currentTime);
  const duration = usePlayerState((state) => state.duration);

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
