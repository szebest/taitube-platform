import type { Side } from '@kit/ui';

export type ShelfVariant = 'card' | 'poster' | 'channel';
export type ShelfChevronSide = Extract<Side, 'inline-start' | 'inline-end'>;
