import type { PublicFeedSort } from '@vp/domain';

export type StartHereSource = 'pinned' | Extract<PublicFeedSort, 'popular'>;
