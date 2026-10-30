import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ContractBody, resolveCommentReport } from '@vp/api-contracts';
import { useApi } from '@vp/queries';

import { adminReportKeys } from '#app/features/admin/api/admin-reports';

export type ReportResolution = ContractBody<typeof resolveCommentReport>['resolution'];

/** Closes a report as removed, which deletes the comment, or as dismissed. */
export function useResolveReport() {
  const api = useApi();

  return useMutation(
    mutationOptions({
      mutationFn: ({ id, resolution }: { id: string; resolution: ReportResolution }) =>
        api.commentReports.resolveCommentReport({ params: { id }, body: { resolution } }),
      onSettled: (_data, _error, _variables, _snapshot, { client }) =>
        client.invalidateQueries({ queryKey: adminReportKeys.all }),
    })
  );
}
