import { Adapters } from '@vp/adapters/composition';
import type { Container } from '@vp/composition';
import { ChannelAuditService, ChannelInviteService, ChannelMemberService } from '../services/index';
import { Services } from './service-tokens';

export function registerTeamServices(c: Container): Container {
  return c
    .provide(
      Services.ChannelInviteService,
      (c) =>
        new ChannelInviteService({
          invites: c.get(Adapters.Repositories).channelInvites,
          members: c.get(Adapters.Repositories).channelMembers,
          channels: c.get(Adapters.Repositories).channels,
          now: Date.now,
        })
    )
    .provide(
      Services.ChannelMemberService,
      (c) =>
        new ChannelMemberService({
          members: c.get(Adapters.Repositories).channelMembers,
          invites: c.get(Adapters.Repositories).channelInvites,
          channels: c.get(Adapters.Repositories).channels,
        })
    )
    .provide(
      Services.ChannelAuditService,
      (c) =>
        new ChannelAuditService({
          audit: c.get(Adapters.Repositories).channelAudit,
          channels: c.get(Adapters.Repositories).channels,
          paginator: c.get(Services.Paginator),
        })
    );
}
