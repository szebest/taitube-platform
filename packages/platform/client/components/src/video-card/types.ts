import type { AvatarSize } from '@kit/ui';

export type VideoCardVariant = 'grid' | 'shelf' | 'row' | 'poster' | 'spotlight';
export type VideoCardState = 'rest' | 'live' | 'premiere' | 'unavailable';
/** `AvatarSize` is `@kit/ui`'s re-export of the shared `SizeOption`, which web does not depend on directly. */
export type VideoCardSize = Extract<AvatarSize, 'sm' | 'md'>;

/** Where a pointer resting on a card is: not there, waiting out the delay, or expanded. */
export type VideoCardHover = 'idle' | 'waiting' | 'expanded';
