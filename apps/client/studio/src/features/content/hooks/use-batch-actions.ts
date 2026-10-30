import { useMutation } from '@tanstack/react-query';
import type { VideoVisibility } from '@vp/domain';
import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { useToast } from '@vp/ui';

import {
  type BatchOutcome,
  type BatchVideo,
  deleteVideosMutationOptions,
  setVisibilityMutationOptions,
} from '../api/batch-actions';

type DoneMessage = 'studio.batchDeleted' | 'studio.batchVisibilitySet';

export function useBatchActions() {
  const api = useApi();
  const toast = useToast();
  const { tOr } = useT();
  const remove = useMutation(deleteVideosMutationOptions(api));
  const reveal = useMutation(setVisibilityMutationOptions(api));

  const report = (total: number, { succeeded, failed }: BatchOutcome, done: DoneMessage) => {
    if (failed.length === 0) {
      toast({ tone: 'success', title: tOr(done, { count: total }, '') });
      return;
    }
    if (succeeded.length === 0) {
      toast({ tone: 'danger', title: tOr('studio.batchFailed', {}, '') });
      return;
    }
    toast({
      tone: 'warning',
      title: tOr(
        'studio.batchPartial',
        { done: succeeded.length, total, failed: failed.length },
        ''
      ),
    });
  };

  const deleteVideos = async (videos: readonly BatchVideo[]) => {
    const outcome = await remove.mutateAsync(videos);
    report(videos.length, outcome, 'studio.batchDeleted');
    return outcome;
  };

  const setVisibility = async (videos: readonly BatchVideo[], visibility: VideoVisibility) => {
    const outcome = await reveal.mutateAsync({ videos, visibility });
    report(videos.length, outcome, 'studio.batchVisibilitySet');
    return outcome;
  };

  return { deleteVideos, setVisibility, pending: remove.isPending || reveal.isPending };
}
