import { PLAYBACK_SETTINGS } from '@vp/domain/settings';
import { useT } from '@vp/intl-react';
import { DropdownMenu, IconButton, type PortalContainer } from '@vp/ui';
import { Captions, Gauge, Settings, SlidersHorizontal, Type } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import {
  AUTO_QUALITY,
  usePlayerCommands,
  usePlayerContainer,
  usePlayerState,
} from '../engine/video-js-engine';
import { useCaptionTrackLabel } from '../hooks/use-caption-track-label';

const CAPTIONS_OFF = 'off';

export function SettingsMenu() {
  const [open, setOpen] = useState(false);

  const container = usePlayerContainer();
  const { requestControlsLock } = usePlayerCommands();
  const { tOr } = useT();

  useEffect(() => {
    if (!open) {
      return;
    }

    const release = requestControlsLock();
    return release;
  }, [open, requestControlsLock]);

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <IconButton aria-label={tOr('player.settings', {}, '')}>
          <Settings aria-hidden="true" />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content container={container} side="block-start" align="end" className="w-64">
        <QualitySubmenu container={container} />
        <SpeedSubmenu container={container} />
        <CaptionsSubmenus container={container} />
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

interface SubmenuProps<Value extends string> extends PortalContainer {
  icon: ReactNode;
  label: string;
  hint: string;
  value: Value;
  onValueChange: (value: Value) => void;
  choices: readonly { value: Value; label: string }[];
}

function Submenu<Value extends string>({
  icon,
  label,
  hint,
  value,
  onValueChange,
  choices,
  container,
}: SubmenuProps<Value>) {
  const handleValueChange = (next: string) => {
    const choice = choices.find((candidate) => candidate.value === next);
    if (choice) {
      onValueChange(choice.value);
    }
  };

  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger>
        {icon}
        {label}
        <span className="ms-auto text-fg-muted">{hint}</span>
      </DropdownMenu.SubTrigger>
      <DropdownMenu.SubContent container={container}>
        <DropdownMenu.RadioGroup value={value} onValueChange={handleValueChange}>
          {choices.map((choice) => (
            <DropdownMenu.RadioItem key={choice.value} value={choice.value}>
              {choice.label}
            </DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
      </DropdownMenu.SubContent>
    </DropdownMenu.Sub>
  );
}

function QualitySubmenu({ container }: PortalContainer) {
  const renditions = usePlayerState((state) => state.renditions);
  const quality = usePlayerState((state) => state.quality);
  const activeHeight = usePlayerState((state) => state.activeHeight);
  const { selectVideoRendition } = usePlayerCommands();
  const { tOr } = useT();

  if (renditions.length === 0) {
    return null;
  }

  const auto = {
    value: AUTO_QUALITY,
    label: activeHeight
      ? tOr('player.autoQualityAt', { height: activeHeight }, '')
      : tOr('player.autoQuality', {}, ''),
  };
  const byHeight = renditions
    .flatMap(({ id, height }) => (height ? [{ id, height }] : []))
    .toSorted((higher, lower) => lower.height - higher.height)
    .map(({ id, height }) => ({ value: id, label: tOr('videos.resolution', { height }, '') }));
  const choices = [auto, ...byHeight];

  return (
    <Submenu
      icon={<SlidersHorizontal aria-hidden="true" />}
      label={tOr('player.quality', {}, '')}
      hint={choices.find(({ value }) => value === quality)?.label ?? auto.label}
      value={quality}
      onValueChange={selectVideoRendition}
      choices={choices}
      container={container}
    />
  );
}

function SpeedSubmenu({ container }: PortalContainer) {
  const playbackRate = usePlayerState((state) => state.playbackRate);
  const { setPlaybackRate } = usePlayerCommands();
  const { tOr } = useT();

  const choices = PLAYBACK_SETTINGS.speed.options.map((rate) => ({
    value: String(rate),
    label: rate === 1 ? tOr('player.normalSpeed', {}, '') : tOr('player.rate', { rate }, ''),
  }));

  return (
    <Submenu
      icon={<Gauge aria-hidden="true" />}
      label={tOr('player.speed', {}, '')}
      hint={choices.find(({ value }) => value === String(playbackRate))?.label ?? ''}
      value={String(playbackRate)}
      onValueChange={(rate) => setPlaybackRate(Number(rate))}
      choices={choices}
      container={container}
    />
  );
}

function CaptionsSubmenus({ container }: PortalContainer) {
  const tracks = usePlayerState((state) => state.captionTracks);
  const active = usePlayerState((state) => state.activeCaptionTrack);
  const { size, background } = usePlayerState((state) => state.captionStyle);
  const { selectCaptionTrack, setCaptionStyle } = usePlayerCommands();
  const { tOr } = useT();
  const labelOf = useCaptionTrackLabel();

  if (tracks.length === 0) {
    return null;
  }

  const off = { value: CAPTIONS_OFF, label: tOr('player.captionsOff', {}, '') };
  const trackChoices = tracks.map((track) => ({ value: track.id, label: labelOf(track) }));
  const sizeChoices = PLAYBACK_SETTINGS.captionsSize.options.map((option) => ({
    value: option,
    label: tOr('player.captionSizeOption', { size: option }, ''),
  }));
  const backgroundChoices = PLAYBACK_SETTINGS.captionsBackground.options.map((option) => ({
    value: option,
    label: tOr('player.captionBackgroundOption', { background: option }, ''),
  }));

  const handleTrackChange = (value: string) =>
    selectCaptionTrack(value === CAPTIONS_OFF ? null : value);

  return (
    <>
      <Submenu
        icon={<Captions aria-hidden="true" />}
        label={tOr('player.captions', {}, '')}
        hint={active ? labelOf(active) : off.label}
        value={active?.id ?? CAPTIONS_OFF}
        onValueChange={handleTrackChange}
        choices={[off, ...trackChoices]}
        container={container}
      />
      <Submenu
        icon={<Type aria-hidden="true" />}
        label={tOr('player.captionSize', {}, '')}
        hint={tOr('player.captionSizeOption', { size }, '')}
        value={size}
        onValueChange={(next) => setCaptionStyle({ size: next })}
        choices={sizeChoices}
        container={container}
      />
      <Submenu
        icon={<Type aria-hidden="true" />}
        label={tOr('player.captionBackground', {}, '')}
        hint={tOr('player.captionBackgroundOption', { background }, '')}
        value={background}
        onValueChange={(next) => setCaptionStyle({ background: next })}
        choices={backgroundChoices}
        container={container}
      />
    </>
  );
}
