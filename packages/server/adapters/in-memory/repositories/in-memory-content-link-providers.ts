import type { Container } from '@kit/composition';
import { InMemoryContentLinkDismissalRepository } from './in-memory-content-link-dismissal-repository';
import { InMemoryContentLinkRepository } from './in-memory-content-link-repository';
import { InMemoryContentLinkStatsRepository } from './in-memory-content-link-stats-repository';
import { Repo } from './in-memory-repo-tokens';
import { InMemoryVideoEndScreenRepository } from './in-memory-video-end-screen-repository';

/** The link graph, its dismissed suggestions, per-link stats and the end screens. */
export function provideContentLinks(container: Container): Container {
  return container
    .provide(Repo.contentLinks, () => new InMemoryContentLinkRepository())
    .provide(Repo.contentLinkDismissals, () => new InMemoryContentLinkDismissalRepository())
    .provide(
      Repo.contentLinkStats,
      (c) => new InMemoryContentLinkStatsRepository(c.get(Repo.contentLinks))
    )
    .provide(Repo.videoEndScreens, () => new InMemoryVideoEndScreenRepository());
}

export function contentLinksOf(c: Container) {
  return {
    contentLinks: c.get(Repo.contentLinks),
    contentLinkDismissals: c.get(Repo.contentLinkDismissals),
    contentLinkStats: c.get(Repo.contentLinkStats),
    videoEndScreens: c.get(Repo.videoEndScreens),
  };
}

export type ContentLinkRepositories = ReturnType<typeof contentLinksOf>;
