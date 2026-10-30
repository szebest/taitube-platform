import { useQuery } from '@tanstack/react-query';
import { useApi } from '@vp/queries';

import { PickOfTheDaySkeleton } from '#app/components/discovery/pick-of-the-day';
import { currentPickQueryOptions } from '#app/features/home/api/home-queries';
import { spotlightOf } from '#app/features/home/spotlight';
import { SpotlightCard } from './spotlight-card';

/** Home's spotlight: the scheduled pick or the fallback. Nothing at all when there is none, or it cannot be read. */
export function HomePick() {
  const api = useApi();
  const { data, isPending } = useQuery(currentPickQueryOptions(api));

  if (isPending) return <PickOfTheDaySkeleton />;
  if (!data) return null;

  return <SpotlightCard spotlight={spotlightOf(data)} />;
}
