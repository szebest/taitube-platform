import { lazyComponent } from '@kit/ui';

export const LazyVoiceDock = lazyComponent(() => import('./voice-dock'), {
  name: 'VoiceDock',
  pick: (module) => module.VoiceDock,
  fallback: false,
});
