import type { Container } from '@kit/composition';
import { InMemoryContentLinkDismissalRepository } from './in-memory-content-link-dismissal-repository';
import { InMemoryContentLinkRepository } from './in-memory-content-link-repository';
import { InMemoryContentLinkStatsRepository } from './in-memory-content-link-stats-repository';
import { InMemoryContentRefDirectory } from './in-memory-content-ref-directory';
import { Repo } from './in-memory-repo-tokens';
import { InMemoryVideoEndScreenRepository } from './in-memory-video-end-screen-repository';

/** The link graph, its dismissed suggestions, per-link stats and the end screens. */
export function provideContentLinks(container: Container): Container {
  return container
    .provide(Repo.contentLinks, () => new InMemoryContentLinkRepository())
    .provide(
      Repo.contentRefs,
      (c) =>
        new InMemoryContentRefDirectory({
          videos: c.get(Repo.videos),
          clips: c.get(Repo.clips),
          posts: c.get(Repo.channelPosts),
          threads: c.get(Repo.videoThreads),
          playlists: c.get(Repo.playlists),
          liveStreams: c.get(Repo.liveStreams),
          channels: c.get(Repo.channels),
        })
    )
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
    contentRefs: c.get(Repo.contentRefs),
    contentLinkDismissals: c.get(Repo.contentLinkDismissals),
    contentLinkStats: c.get(Repo.contentLinkStats),
    videoEndScreens: c.get(Repo.videoEndScreens),
  };
}

export type ContentLinkRepositories = ReturnType<typeof contentLinksOf>;
