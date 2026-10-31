import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useApi } from '@vp/queries';
import { useDeferredValue } from 'react';

import { pickableVideosQueryOptions } from '#app/features/admin/api/pick-videos';

/** Public, ready videos matching what the editor typed; the list follows the typing, a beat behind. */
export function usePickableVideos(text: string) {
  const deferred = useDeferredValue(text);

  return useQuery({
    ...pickableVideosQueryOptions(useApi(), deferred),
    placeholderData: keepPreviousData,
  });
}
