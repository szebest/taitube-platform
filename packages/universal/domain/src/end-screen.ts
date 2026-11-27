import type { ContentRef } from './content-link';

export const END_SCREEN_LAYOUTS = ['grid', 'row', 'hero'] as const;

export type EndScreenLayout = (typeof END_SCREEN_LAYOUTS)[number];

export const END_SCREEN_MAX_ITEMS = 4;
export const END_SCREEN_MIN_LEAD_MS = 5_000;
export const END_SCREEN_MAX_LEAD_MS = 20_000;

/** `next_episode` is filled at read for the viewer and is absent when the series has nothing next. */
export type EndScreenItem =
  | { type: 'content'; ref: ContentRef }
  | { type: 'channel_tab'; channelId: string; tabId: string }
  | { type: 'next_episode' }
  | { type: 'subscribe' };

export type EndScreenItemType = EndScreenItem['type'];

export interface EndScreen {
  videoId: string;
  layout: EndScreenLayout;
  startsAtMs: number;
  items: EndScreenItem[];
  showSubscribe: boolean;
  version: number;
}

/** The latest and earliest start an end screen may have on a video of this length. */
export function endScreenStartWindow(durationMs: number): { earliest: number; latest: number } {
  return {
    earliest: Math.max(0, durationMs - END_SCREEN_MAX_LEAD_MS),
    latest: Math.max(0, durationMs - END_SCREEN_MIN_LEAD_MS),
  };
}
