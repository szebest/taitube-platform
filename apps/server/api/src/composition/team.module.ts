import type { Container } from '@kit/composition';
import { Adapters } from '@vp/adapters/composition';
import {
  AccountSecurityService,
  ChannelAuditService,
  ChannelInviteService,
  ChannelMemberService,
  MyChannelsService,
} from '../services/index';
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
          paginator: c.get(Services.Paginator),
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
    )
    .provide(
      Services.MyChannelsService,
      (c) =>
        new MyChannelsService({
          users: c.get(Adapters.Repositories).users,
          channels: c.get(Adapters.Repositories).channels,
          handleHistory: c.get(Adapters.Repositories).channelHandleHistory,
          members: c.get(Adapters.Repositories).channelMembers,
          maxOwned: c.get(Adapters.Config).limits.channelsMaxOwned,
          now: Date.now,
        })
    )
    .provide(
      Services.AccountSecurityService,
      (c) =>
        new AccountSecurityService({
          audit: c.get(Adapters.Repositories).accountAudit,
          paginator: c.get(Services.Paginator),
        })
    );
}
