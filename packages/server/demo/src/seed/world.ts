import type { DemoOptions } from '../types';
import { CATEGORIES } from './catalog';
import { createRng, deriveSeed } from './rng';
import { buildEngagement } from './world-engagement';
import type { WorldSpec } from './world-types';
import { buildUsers } from './world-users';
import { buildVideos } from './world-videos';

const MAX_CLIP_SECONDS = { minimal: 16, full: 30 } as const;

/** Everything the seed will create, derived from the options alone: the same seed gives the same world. */
export function buildWorld(options: DemoOptions): WorldSpec {
  const stream = (label: string) => createRng(deriveSeed(options.seed, label));
  const users = buildUsers(stream('users'), options.users, options.channels);
  const owners = users.filter((user) => user.ownsChannel);
  const videos = buildVideos(
    stream('videos'),
    owners,
    options.videos,
    MAX_CLIP_SECONDS[options.profile]
  );

  return {
    seed: options.seed,
    categories: CATEGORIES.map(({ slug, name, description }, sortOrder) => ({
      slug,
      name,
      description,
      sortOrder,
    })),
    users,
    videos,
    ...buildEngagement(stream('engagement'), users, videos),
  };
}
