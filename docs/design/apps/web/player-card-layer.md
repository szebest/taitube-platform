# PlayerCardLayer

Timed cards laid over the player's picture: a correction while the playhead is inside its range, and later a link card ([122](../../../tickets/122-linked-content-graph.md)). It lives in web's kit, `apps/client/web/src/components/player/player-card-layer/`, and `TaitubePlayer` draws it when it is given `cards` ([57](../../../tickets/57-production-video-player-hls-streaming-controls.md), [116](../../../tickets/116-video-management-power-tools.md)).

## Anatomy

```
 +--------------------------------------------------+
 |                                                  |
 |  +-----------------------------+                 |
 |  | The price is 5 dollars   [x]|                 |   1 card, lower start corner
 |  +-----------------------------+                 |
 |  ==== seek bar / control bar ====================|   never covered
 +--------------------------------------------------+
```

| # | Part | Notes |
|---|---|---|
| 1 | Card | `role="note"`, at most 80% of the width and 24rem, on the media scrim; the dismiss button is a small ghost `Button` |

## Behaviour

| Rule | How |
|---|---|
| One at a time | the first card of the list whose `[startMs, endMs)` holds the playhead, read through `usePlayerTime`, so it re-renders only when the active card changes |
| Corner-anchored, never over the controls | `bottom-20` from the stage, above the control bar, `start` side |
| Dismissible by keyboard | Tab reaches the dismiss button; Escape inside the card dismisses it and stops there, so it never also exits fullscreen |
| Stays dismissed | the dismissed ids are kept for the watch, so scrubbing back does not bring a card back |
| Reduced motion | the entrance is `motion-safe` only |

## Props

```ts
interface PlayerCard { id: string; startMs: number; endMs: number; text: string }
interface PlayerCardLayerProps { cards: readonly PlayerCard[] }
```

It needs `PlayerChannelProvider` above it, as every reader of the playhead does; the watch page and the embed provide it.

## Accessibility

A note with a named dismiss button; the card never takes focus by itself, so playback keys keep working; contrast is the media scrim with `text-on-media`.
