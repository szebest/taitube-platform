import { lazyComponent } from '@kit/ui';

export const LazyReportCommentDialog = lazyComponent(() => import('./report-comment-dialog'), {
  name: 'ReportCommentDialog',
  pick: (module) => module.ReportCommentDialog,
});
