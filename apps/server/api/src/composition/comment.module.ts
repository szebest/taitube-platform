import { Adapters } from '@vp/adapters/composition';
import type { Container } from '@vp/composition';
import { Singleflight } from '@vp/concurrency';
import {
  CommentReportService,
  CommentService,
  CommentSettingsService,
  CreatorCommentService,
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
