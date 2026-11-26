import { useToast } from '@kit/ui';
import { useMutation } from '@tanstack/react-query';
import type { BulkEditPatch } from '@vp/domain';
import { ErrorCodes, isErrorCode } from '@vp/errors';
import { present, useApi } from '@vp/queries';
import { useT } from '#app/lib/messages';
import {
  type BatchOutcome,
  type BatchVideo,
  deleteVideosMutationOptions,
  editVideosMutationOptions,
} from '../api/batch-actions';

type DoneMessage = 'studio.batchDeleted' | 'studio.batchUpdated';

const FAILURES_LISTED = 5;

export function useBatchActions() {
  const api = useApi();
  const toast = useToast();
  const { tOr } = useT();
  const remove = useMutation(deleteVideosMutationOptions(api));
  const edit = useMutation(editVideosMutationOptions(api));

  const describeFailures = (videos: readonly BatchVideo[], { failed }: BatchOutcome) => {
    const lines = failed.slice(0, FAILURES_LISTED).map(({ id, code }) =>
      tOr(
        'studio.batchFailure',
        {
          title: videos.find((video) => video.id === id)?.title ?? tOr('browse.untitled', {}, ''),
          code,
          reason: tOr(
            present({ code: isErrorCode(code) ? code : ErrorCodes.INTERNAL }).copy,
            {},
            ''
          ),
        },
        ''
      )
    );
    const more = failed.length - FAILURES_LISTED;
    return [
      ...lines,
      ...(more > 0 ? [tOr('studio.batchFailureMore', { count: more }, '')] : []),
    ].join('; ');
  };

  const report = (videos: readonly BatchVideo[], outcome: BatchOutcome, done: DoneMessage) => {
    const { succeeded, failed } = outcome;
    if (failed.length === 0) {
      toast({ tone: 'success', title: tOr(done, { count: videos.length }, '') });
      return;
    }
    const description = describeFailures(videos, outcome);
    if (succeeded.length === 0) {
      toast({ tone: 'danger', title: tOr('studio.batchFailed', {}, ''), description });
      return;
    }
    toast({
      tone: 'warning',
      title: tOr(
        'studio.batchPartial',
        { done: succeeded.length, total: videos.length, failed: failed.length },
        ''
      ),
      description,
    });
  };

  const deleteVideos = async (videos: readonly BatchVideo[]) => {
    const outcome = await remove.mutateAsync(videos);
    report(videos, outcome, 'studio.batchDeleted');
    return outcome;
  };

  const editVideos = async (videos: readonly BatchVideo[], patch: BulkEditPatch) => {
    const outcome = await edit.mutateAsync({ videos, patch });
    report(videos, outcome, 'studio.batchUpdated');
    return outcome;
  };

  return { deleteVideos, editVideos, pending: remove.isPending || edit.isPending };
}
