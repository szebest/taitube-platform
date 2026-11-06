import { lazyComponent } from '@vp/ui';

export const LazyReportCommentDialog = lazyComponent(() => import('./report-comment-dialog'), {
  name: 'ReportCommentDialog',
  pick: (module) => module.ReportCommentDialog,
});
