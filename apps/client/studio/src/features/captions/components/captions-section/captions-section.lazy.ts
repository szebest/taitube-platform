import { lazyComponent } from '@vp/ui';

export const LazyCaptionsSection = lazyComponent(() => import('./captions-section'), {
  name: 'CaptionsSection',
  pick: (module) => module.CaptionsSection,
  fallback: false,
});
