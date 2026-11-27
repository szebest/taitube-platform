export type ShortsFrameState = 'ready' | 'loading' | 'error' | 'empty' | 'ended';
export type ShortsActionsLayout = 'beside' | 'overlay';

export type ShortsPlayback = {
  paused: boolean;
  onTogglePlay: () => void;
};
