import type { Container } from '@kit/composition';
import type { Clock } from './clock';
import { InMemoryChannelAuditRepository } from './in-memory-channel-audit-repository';
import { InMemoryChannelFeaturedRepository } from './in-memory-channel-featured-repository';
import { InMemoryChannelHandleHistoryRepository } from './in-memory-channel-handle-history-repository';
import { InMemoryChannelImageRepository } from './in-memory-channel-image-repository';
import { InMemoryChannelInviteRepository } from './in-memory-channel-invite-repository';
import { InMemoryChannelLayoutRepository } from './in-memory-channel-layout-repository';
import { InMemoryChannelLayoutScheduleRepository } from './in-memory-channel-layout-schedule-repository';
import { InMemoryChannelMemberRepository } from './in-memory-channel-member-repository';
import { InMemoryChannelPageRepository } from './in-memory-channel-page-repository';
import { InMemoryChannelPageSources } from './in-memory-channel-page-sources';
import { InMemoryChannelRepository } from './in-memory-channel-repository';
import { Repo } from './in-memory-repo-tokens';

/** The channels and what hangs off one: its handle history, audit log, team, invites, images and pages. */
export function provideChannels(container: Container, now: Clock): Container {
  return container
    .provide(Repo.channelHandleHistory, () => new InMemoryChannelHandleHistoryRepository())
    .provide(
      Repo.channels,
      (c) =>
        new InMemoryChannelRepository(
          c.get(Repo.videos),
          c.get(Repo.channelHandleHistory),
          c.get(Repo.channelAudit)
        )
    )
    .provide(Repo.channelAudit, () => new InMemoryChannelAuditRepository())
    .provide(
      Repo.channelMembers,
      (c) =>
        new InMemoryChannelMemberRepository({
          channels: c.get(Repo.channels),
          audit: c.get(Repo.channelAudit),
          invites: { revokeSentBy: (sent) => c.get(Repo.channelInvites).revokeSentBy(sent) },
        })
    )
    .provide(
      Repo.channelInvites,
      (c) =>
        new InMemoryChannelInviteRepository({
          members: c.get(Repo.channelMembers),
          channels: c.get(Repo.channels),
          audit: c.get(Repo.channelAudit),
          outbox: c.get(Repo.outbox),
          now,
        })
    )
    .provide(Repo.channelFeatured, (c) => new InMemoryChannelFeaturedRepository(c.get(Repo.videos)))
    .provide(
      Repo.channelImages,
      (c) =>
        new InMemoryChannelImageRepository({
          channels: c.get(Repo.channels),
          audit: c.get(Repo.channelAudit),
          userEvents: c.get(Repo.userEvents),
        })
    )
    .provide(Repo.channelPages, (c) => new InMemoryChannelPageRepository(c.get(Repo.videos)))
    .provide(
      Repo.channelLayouts,
      (c) =>
        new InMemoryChannelLayoutRepository(
          { revisions: c.get(Repo.entityRevisions), audit: c.get(Repo.channelAudit) },
          now
        )
    )
    .provide(
      Repo.channelLayoutSchedules,
      (c) =>
        new InMemoryChannelLayoutScheduleRepository(
          { revisions: c.get(Repo.entityRevisions), audit: c.get(Repo.channelAudit) },
          now
        )
    )
    .provide(
      Repo.channelPageSources,
      (c) =>
        new InMemoryChannelPageSources({
          videos: () => c.get(Repo.videos),
          posts: () => c.get(Repo.channelPosts),
          playlists: () => c.get(Repo.playlists),
          live: () => c.get(Repo.liveStreams),
          channels: () => c.get(Repo.channels),
          featured: () => c.get(Repo.channelFeatured),
          smart: () => c.get(Repo.smartPlaylists),
        })
    );
}

export function channelContentOf(c: Container) {
  return {
    channelFeatured: c.get(Repo.channelFeatured),
    channelImages: c.get(Repo.channelImages),
    channelPages: c.get(Repo.channelPages),
    channelLayouts: c.get(Repo.channelLayouts),
    channelLayoutSchedules: c.get(Repo.channelLayoutSchedules),
    channelPageSources: c.get(Repo.channelPageSources),
    channelPosts: c.get(Repo.channelPosts),
    postEngagement: c.get(Repo.postEngagement),
  };
}

export type ChannelContentRepositories = ReturnType<typeof channelContentOf>;
