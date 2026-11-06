import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { ContractBody, reportComment } from '@vp/api-contracts';
import { useApi } from '@vp/queries';

type CommentReportDraft = ContractBody<typeof reportComment>;

function reportCommentMutationOptions(api: ApiClient, commentId: string) {
  return mutationOptions({
    mutationFn: (report: CommentReportDraft) =>
      api.commentReports.reportComment({ params: { id: commentId }, body: report }),
  });
}

export function useReportComment(commentId: string) {
  const api = useApi();
  return useMutation(reportCommentMutationOptions(api, commentId));
}
