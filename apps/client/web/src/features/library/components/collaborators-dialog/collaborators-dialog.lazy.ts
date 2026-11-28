import { lazyComponent } from '@kit/ui';

export const LazyCollaboratorsDialog = lazyComponent(() => import('./collaborators-dialog'), {
  name: 'CollaboratorsDialog',
  pick: (module) => module.CollaboratorsDialog,
});
