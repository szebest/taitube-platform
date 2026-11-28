import { Button } from '@kit/ui';
import { PartyCan } from '@vp/permissions-react';
import { type ComponentPropsWithRef, useEffect, useRef } from 'react';
import { useT } from '#app/lib/messages';
import { RISE_FRAMES, RISE_MS } from './constants';

/** Drawn over the stage: emoji that rise and fade, or, for a viewer on reduced motion, count chips. */
export function ReactionOverlayRoot({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div
      data-slot="reaction-overlay"
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 bottom-0 flex h-1/2 items-end justify-center gap-inline overflow-hidden ${className ?? ''}`}
      {...props}
    />
  );
}

export interface ReactionOverlayBurstProps extends ComponentPropsWithRef<'span'> {
  emoji: string;
  /** Where along the stage's width it rises, from 0 to 100. */
  at: number;
}

export function ReactionOverlayBurst({
  emoji,
  at,
  className,
  ...props
}: ReactionOverlayBurstProps) {
  const element = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    element.current?.animate?.(RISE_FRAMES, {
      duration: RISE_MS,
      easing: 'ease-out',
      fill: 'forwards',
    });
  }, []);

  return (
    <span
      ref={element}
      data-slot="reaction-overlay-burst"
      className={`absolute bottom-0 text-title-lg opacity-0 ${className ?? ''}`}
      style={{ insetInlineStart: `${at}%` }}
      {...props}
    >
      {emoji}
    </span>
  );
}

export interface ReactionOverlayChipProps {
  emoji: string;
  count: number;
}

/** The static form of a burst, for reduced motion. */
export function ReactionOverlayChip({ emoji, count }: ReactionOverlayChipProps) {
  const { tOr } = useT();

  return (
    <span
      data-slot="reaction-overlay-chip"
      role="img"
      aria-label={tOr('party.reactionChip', { count, emoji }, '')}
      className="rounded-chip bg-tint px-inset-control text-label"
    >
      {emoji} {count}
    </span>
  );
}

export interface ReactionOverlayBarProps<Emoji extends string> {
  emojis: readonly Emoji[];
  onReact: (emoji: Emoji) => void;
}

/** The palette under the stage, for `chat.react`. */
export function ReactionOverlayBar<Emoji extends string>({
  emojis,
  onReact,
}: ReactionOverlayBarProps<Emoji>) {
  const { tOr } = useT();

  return (
    <PartyCan gate={{ kind: 'permission', permission: 'chat.react' }}>
      <div
        data-slot="reaction-bar"
        role="group"
        aria-label={tOr('party.reactionBar', {}, '')}
        className="flex flex-wrap gap-inline"
      >
        {emojis.map((emoji) => (
          <Button
            key={emoji}
            size="sm"
            variant="ghost"
            aria-label={tOr('party.reactionSend', { emoji }, '')}
            onClick={() => onReact(emoji)}
          >
            {emoji}
          </Button>
        ))}
      </div>
    </PartyCan>
  );
}
