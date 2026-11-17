import { lazyComponent } from '@kit/ui';

export const LazyTranscriptPanel = lazyComponent(() => import('./transcript-panel'), {
  name: 'TranscriptPanel',
  pick: (module) => module.TranscriptPanel,
});
