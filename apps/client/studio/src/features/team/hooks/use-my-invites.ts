import { useInfiniteQuery } from '@tanstack/react-query';
import { useApi } from '@vp/queries';
import { myInvitesQueryOptions } from '#app/features/team/api/team-queries';
import { pagedRows } from '#app/utils/paged-rows';

/** The invites to a team the viewer can still answer, over every page loaded so far. */
export function useMyInvites() {
  return useInfiniteQuery({ ...myInvitesQueryOptions(useApi()), select: pagedRows });
}
