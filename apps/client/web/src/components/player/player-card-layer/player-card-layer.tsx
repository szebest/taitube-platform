import { useT } from '@kit/intl-react';
import { Button } from '@kit/ui';
import { useState } from 'react';
import { usePlayerTime } from '#app/lib/player/player-channel';
import type { PlayerCard } from '#app/lib/player/taitube-player-props';

export interface PlayerCardLayerProps {
  cards: readonly PlayerCard[];
}

const MS_PER_SECOND = 1000;

/**
 * Timed cards laid over the picture: the first whose range holds the playhead, one at a time, in the
 * lower start corner above the control bar. A viewer dismisses a card with its button or Escape and it
 * stays gone for the rest of the watch.
 */
export function PlayerCardLayer({ cards }: PlayerCardLayerProps) {
  const { tOr } = useT();
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const activeId = usePlayerTime(
    (seconds) =>
      cards.find(
        (card) =>
          !dismissed.has(card.id) &&
          seconds * MS_PER_SECOND >= card.startMs &&
          seconds * MS_PER_SECOND < card.endMs
      )?.id ?? null
  );
  const card = cards.find(({ id }) => id === activeId);
  if (!card) return null;

  const dismiss = () => setDismissed((current) => new Set([...current, card.id]));

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-20 flex px-4">
      <div
        key={card.id}
        role="note"
        data-slot="player-card"
        className="pointer-events-auto flex max-w-[min(24rem,80%)] items-start gap-2 rounded-control bg-media/85 px-3 py-2 text-body-sm text-on-media motion-safe:animate-in motion-safe:fade-in"
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.stopPropagation();
          dismiss();
        }}
      >
        <p className="m-0">{card.text}</p>
        <Button
          variant="ghost"
          size="sm"
          aria-label={tOr('player.cardDismiss', {}, '')}
          onClick={dismiss}
        >
          x
        </Button>
      </div>
    </div>
  );
}
