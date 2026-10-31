import { useMutation } from '@tanstack/react-query';
import type { VideoSummary } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { useApi, useFailureToast } from '@vp/queries';
import { useToast } from '@vp/ui';

import { saveFeaturedMutationOptions } from '../api/channel-featured';

/** Saves the pins: the shelf follows at once, a toast says it held, and a refusal is presented and undone. */
export function useSaveFeatured(channelId: string) {
  const toast = useToast();
  const failureToast = useFailureToast();
  const { tOr } = useT();
  const mutation = useMutation(saveFeaturedMutationOptions(useApi(), channelId));

  const save = (pins: readonly VideoSummary[]) =>
    mutation.mutate(pins, {
      onSuccess: () => toast({ tone: 'success', title: tOr('studio.startHereSaved', {}, '') }),
      onError: (error) =>
        failureToast(tOr('studio.startHereNotSaved', {}, ''), error, () => save(pins)),
    });

  return { save, saving: mutation.isPending, saved: mutation.isSuccess };
}
