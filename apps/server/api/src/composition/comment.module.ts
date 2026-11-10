import { Adapters } from '@vp/adapters/composition';
import type { Container } from '@vp/composition';
import { Singleflight } from '@vp/concurrency';
import {
  ChannelRestrictionService,
  CommentBulkService,
  CommentModerationService,
  CommentRemovalService,
  CommentReportService,
  CommentService,
  CommentSettingsService,
  CreatorCommentService,
  TrustedCommenterService,
} from '../services/index';
import { Services } from './service-tokens';

export function registerCommentServices(c: Container): Container {
  const repositories = () => c.get(Adapters.Repositories);

  return c
    .provide(
      Services.CommentService,
      (c) =>
        new CommentService({
          comments: repositories().comments,
          videos: repositories().videos,
          channels: repositories().channels,
          members: repositories().channelMembers,
          settings: repositories().commentSettings,
          restrictions: repositories().channelUserRestrictions,
          trusted: repositories().trustedCommenters,
          subscriptions: repositories().subscriptions,
          users: repositories().users,
          slowMode: c.get(Adapters.CommentSlowMode),
          now: () => Date.now(),
          commentCache: c.get(Adapters.CommentCache),
          singleflight: new Singleflight(),
          paginator: c.get(Services.Paginator),
        })
    )
    .provide(
      Services.ChannelRestrictionService,
      (c) =>
        new ChannelRestrictionService({
          restrictions: repositories().channelUserRestrictions,
          members: repositories().channelMembers,
          users: repositories().users,
          channels: repositories().channels,
          moderation: repositories().commentModeration,
          notifications: repositories().notifications,
          commentCache: c.get(Adapters.CommentCache),
          paginator: c.get(Services.Paginator),
          now: () => Date.now(),
        })
    )
    .provide(
      Services.CommentBulkService,
      (c) =>
        new CommentBulkService({
          comments: repositories().comments,
          videos: repositories().videos,
          moderation: c.get(Services.CommentModerationService),
          restrictions: c.get(Services.ChannelRestrictionService),
        })
    )
    .provide(
      Services.CommentModerationService,
      (c) =>
        new CommentModerationService({
          comments: repositories().comments,
          videos: repositories().videos,
          channels: repositories().channels,
          settings: repositories().commentSettings,
          moderation: repositories().commentModeration,
          notifications: repositories().notifications,
          commentCache: c.get(Adapters.CommentCache),
        })
    )
    .provide(
      Services.TrustedCommenterService,
      (c) =>
        new TrustedCommenterService({
          trusted: repositories().trustedCommenters,
          users: repositories().users,
          channels: repositories().channels,
          paginator: c.get(Services.Paginator),
        })
    )
    .provide(
      Services.CommentRemovalService,
      (c) =>
        new CommentRemovalService({
          moderation: repositories().commentModeration,
          paginator: c.get(Services.Paginator),
          now: () => Date.now(),
        })
    )
    .provide(
      Services.CommentSettingsService,
      () => new CommentSettingsService({ settings: repositories().commentSettings })
    )
    .provide(
      Services.CommentReportService,
      (c) =>
        new CommentReportService({
          comments: repositories().comments,
          videos: repositories().videos,
          reports: repositories().commentReports,
          commentService: c.get(Services.CommentService),
          paginator: c.get(Services.Paginator),
        })
    )
    .provide(
      Services.CreatorCommentService,
      (c) =>
        new CreatorCommentService({
          comments: repositories().comments,
          paginator: c.get(Services.Paginator),
        })
    );
}
