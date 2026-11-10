import { mutationOptions, useMutation } from '@tanstack/react-query';
import { ApiError } from '@vp/api-client';
import type { ScreeningDecision } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { useToast } from '@vp/ui';
import {
  adminScreeningKeys,
  type ScreeningCase,
  type ScreeningPages,
} from '#app/features/admin/api/admin-screening';

export type ScreeningAction =
  | { kind: 'approve'; videoId: string }
  | { kind: 'reject'; videoId: string; reason: string }
  | { kind: 'dismiss'; videoId: string };

const DECISION = {
  approve: { decision: 'approved', status: 'PROCESSING' },
  reject: { decision: 'rejected', status: 'REJECTED' },
  dismiss: { decision: 'dismissed', status: undefined },
} as const satisfies Record<
  ScreeningAction['kind'],
  { decision: ScreeningDecision; status: ScreeningCase['status'] | undefined }
>;

function decided(screening: ScreeningCase, { kind }: ScreeningAction): ScreeningCase {
  const { decision, status = screening.status } = DECISION[kind];
  return { ...screening, decision, status, open: false };
}

/**
 * Approves, rejects or dismisses the flags of a held video. The row shows the decision at once and
 * every list is fetched again once the API has answered, whatever it said. A refusal puts the row
 * back and toasts why.
 */
export function useScreeningDecision() {
  const api = useApi();
  const { tOr } = useT();
  const toast = useToast();

  return useMutation(
    mutationOptions({
      mutationFn: (action: ScreeningAction) => {
        const params = { id: action.videoId };
        switch (action.kind) {
          case 'approve':
            return api.screening.approveHeldVideo({ params });
          case 'reject':
            return api.screening.rejectHeldVideo({ params, body: { reason: action.reason } });
          case 'dismiss':
            return api.screening.dismissScreeningFlags({ params });
        }
      },
      onMutate: async (action, { client }) => {
        await client.cancelQueries({ queryKey: adminScreeningKeys.all });
        const previous = client.getQueriesData<ScreeningPages>({
          queryKey: adminScreeningKeys.all,
        });
        client.setQueriesData<ScreeningPages>(
          { queryKey: adminScreeningKeys.all },
          (pages) =>
            pages && {
              ...pages,
              pages: pages.pages.map((page) => ({
                ...page,
                items: page.items.map((item) =>
                  item.videoId === action.videoId ? decided(item, action) : item
                ),
              })),
            }
        );
        return { previous };
      },
      onError: (error: unknown, _action, snapshot, { client }) => {
        for (const [key, data] of snapshot?.previous ?? []) {
          client.setQueryData(key, data);
        }

        const conflict = error instanceof ApiError && error.code === ErrorCodes.VERSION_CONFLICT;
        toast({
          tone: 'danger',
          title: tOr(
            conflict ? 'studio.screeningConflict' : 'studio.screeningActionFailed',
            {},
            ''
          ),
        });
      },
      onSettled: (_data, _error, _action, _snapshot, { client }) =>
        client.invalidateQueries({ queryKey: adminScreeningKeys.all }),
    })
  );
}
