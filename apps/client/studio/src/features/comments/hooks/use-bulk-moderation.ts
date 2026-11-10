import type { BulkActionBody } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { useT } from '@vp/intl-react';
import { present, useBulkModerate, useFailureToast } from '@vp/queries';
import { fromPromise } from '@vp/result';
import { useToast } from '@vp/ui';

const SHORT_ID = 8;

/**
 * One action over the given comments. A refusal never fails the batch, so the toast says how many
 * went through and lists each refused id with why; the refused ids come back for the caller to keep selected.
 */
export function useBulkModeration() {
  const { tOr } = useT();
  const showToast = useToast();
  const showFailure = useFailureToast();
  const bulk = useBulkModerate();

  const run = async (ids: string[], action: BulkActionBody): Promise<string[]> => {
    const sent = await fromPromise(bulk.mutateAsync({ ids, action }), (cause) => cause);
    if (!sent.ok) {
      showFailure(tOr('studio.moderationBulkFailed', {}, ''), sent.error);
      return ids;
    }

    const refused = sent.value.results.filter(({ ok }) => !ok);
    if (refused.length === 0) {
      showToast({
        tone: 'success',
        title: tOr('studio.moderationBulkDone', { count: ids.length }, ''),
      });
    } else {
      showToast({
        tone: 'warning',
        title: tOr(
          'studio.moderationBulkPartial',
          { done: ids.length - refused.length, total: ids.length, failed: refused.length },
          ''
        ),
        description: refused
          .map(({ id, code }) =>
            tOr(
              'studio.moderationBulkRefusal',
              {
                id: id.slice(0, SHORT_ID),
                reason: tOr(present({ code: code ?? ErrorCodes.INTERNAL }).copy, {}, ''),
              },
              ''
            )
          )
          .join('; '),
      });
    }
    return refused.map(({ id }) => id);
  };

  return { run, pending: bulk.isPending };
}
