import { lazyComponent } from '@vp/ui';

export const LazyTranscriptPanel = lazyComponent(() => import('./transcript-panel'), {
  name: 'TranscriptPanel',
  pick: (module) => module.TranscriptPanel,
});
