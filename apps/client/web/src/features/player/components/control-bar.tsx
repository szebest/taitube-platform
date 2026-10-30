import { videoDuration } from '@vp/intl';
import { Format, useFormat, useT } from '@vp/intl-react';
import { unwrapOr } from '@vp/result';
import { IconButton } from '@vp/ui';
import { Maximize, Minimize, Pause, Play, Volume1, Volume2, VolumeX } from 'lucide-react';
import { type ChangeEvent, useRef } from 'react';

import { usePlayerCommands, usePlayerState } from '../engine/video-js-engine';
import { SettingsMenu } from './settings-menu';

export function ControlBar() {
  const visible = usePlayerState((state) => state.controlsVisible);

  const { tOr } = useT();

  return (
    <fieldset
      aria-label={tOr('player.controls', {}, '')}
      data-visible={visible || undefined}
      className="tw:absolute tw:inset-x-0 tw:bottom-0 tw:m-0 tw:min-w-0 tw:border-0 tw:bg-linear-to-t tw:from-scrim tw:to-transparent tw:px-3 tw:pt-12 tw:pb-1 tw:transition-opacity tw:duration-200 tw:motion-reduce:transition-none tw:not-data-visible:pointer-events-none tw:not-data-visible:opacity-0 tw:has-focus-visible:pointer-events-auto tw:has-focus-visible:opacity-100"
    >
      <SeekBar />
      <div className="tw:flex tw:items-center tw:gap-1">
        <PlayButton />
        <VolumeControl />
        <ElapsedTime />
        <div className="tw:ms-auto tw:flex tw:items-center tw:gap-1">
          <SettingsMenu />
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
      className="tw:block tw:w-full tw:cursor-pointer tw:accent-accent"
    />
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
    <div className="tw:group/volume tw:flex tw:items-center">
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
        className="tw:w-0 tw:cursor-pointer tw:opacity-0 tw:accent-fg tw:transition-all tw:duration-200 tw:group-focus-within/volume:w-20 tw:group-focus-within/volume:opacity-100 tw:group-hover/volume:w-20 tw:group-hover/volume:opacity-100 tw:motion-reduce:transition-none"
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
    <span className="tw:px-2 tw:text-label tw:whitespace-nowrap tw:tabular-nums">
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
