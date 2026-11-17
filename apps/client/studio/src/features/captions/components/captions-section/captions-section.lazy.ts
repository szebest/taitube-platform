import { lazyComponent } from '@kit/ui';

export const LazyCaptionsSection = lazyComponent(() => import('./captions-section'), {
  name: 'CaptionsSection',
  pick: (module) => module.CaptionsSection,
  fallback: false,
});
