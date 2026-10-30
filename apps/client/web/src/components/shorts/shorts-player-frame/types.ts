export type ShortsFrameState = 'ready' | 'loading' | 'error' | 'empty' | 'ended';
export type ShortsActionsLayout = 'beside' | 'overlay';
export type ShortsDirection = 'previous' | 'next';

export type ShortsPlayback = {
  paused: boolean;
  muted: boolean;
  onTogglePlay: () => void;
  onToggleMute: () => void;
};
