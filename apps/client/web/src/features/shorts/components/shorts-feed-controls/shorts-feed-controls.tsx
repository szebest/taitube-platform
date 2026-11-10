import { PLAYBACK_SETTINGS } from '@vp/domain/settings';
import { useT } from '@vp/intl-react';
import { Button, DropdownMenu, Icon, IconButton } from '@vp/ui';
import { ShortsPlayerFrame } from '#app/components/shorts/shorts-player-frame';

const SCRIM = 'bg-scrim text-on-live';

export interface ShortsFeedControlsProps {
  muted: boolean;
  onToggleMute: () => void;
  captions: boolean;
  /** The Short has captions to show. */
  hasCaptions: boolean;
  onToggleCaptions: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
}

/** Mute, captions and speed of the Short on screen, over the corner of its picture. */
export function ShortsFeedControls({
  muted,
  onToggleMute,
  captions,
  hasCaptions,
  onToggleCaptions,
  speed,
  onSpeedChange,
}: ShortsFeedControlsProps) {
  const { tOr } = useT();

  return (
    <ShortsPlayerFrame.Toolbar label={tOr('shorts.controls', {}, '')}>
      <IconButton
        size="sm"
        className={SCRIM}
        aria-label={tOr(muted ? 'player.unmute' : 'player.mute', {}, '')}
        aria-pressed={muted}
        onClick={onToggleMute}
      >
        <Icon name="volume" className={muted ? 'opacity-60' : undefined} />
      </IconButton>
      <IconButton
        size="sm"
        className={SCRIM}
        aria-label={tOr('player.captions', {}, '')}
        aria-pressed={captions && hasCaptions}
        disabled={!hasCaptions}
        onClick={onToggleCaptions}
      >
        <Icon name="captions" />
      </IconButton>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className={SCRIM}
            aria-label={`${tOr('player.speed', {}, '')}, ${tOr('player.rate', { rate: speed }, '')}`}
          >
            {tOr('player.rate', { rate: speed }, '')}
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end">
          <DropdownMenu.RadioGroup
            value={String(speed)}
            onValueChange={(rate) => onSpeedChange(Number(rate))}
          >
            {PLAYBACK_SETTINGS.speed.options.map((rate) => (
              <DropdownMenu.RadioItem key={rate} value={String(rate)}>
                {rate === 1 ? tOr('player.normalSpeed', {}, '') : tOr('player.rate', { rate }, '')}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </ShortsPlayerFrame.Toolbar>
  );
}
