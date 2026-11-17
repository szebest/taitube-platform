import { lazyComponent } from '@kit/ui';

export const LazySignInDialog = lazyComponent(() => import('./sign-in-dialog'), {
  name: 'SignInDialog',
  pick: (module) => module.SignInDialog,
});
