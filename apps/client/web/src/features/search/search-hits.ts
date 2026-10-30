import type { SearchResultItem } from '@vp/api-contracts';

type HitOf<Kind extends SearchResultItem['type']> = Extract<
  SearchResultItem,
  { type: Kind }
>['data'];

export type VideoHit = HitOf<'video'>;
export type ChannelHit = HitOf<'channel'>;
export type PlaylistHit = HitOf<'playlist'>;
