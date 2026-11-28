import type { ActingChannel } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { pageAudit } from '../channel-layout-audit';

const acting: ActingChannel = { channelId: 'channel-1', ownerId: 'owner-1', role: 'editor' };

describe('pageAudit', () => {
  it('names the member and, when the request carried one, the token', () => {
    const member: UserContext = { id: 'user-1', role: 'USER' };
    const viaToken: UserContext = {
      ...member,
      token: { id: 'token-1', scopes: [], channelId: 'channel-1' },
    };
    const event = { action: 'page.published', meta: { version: 2 } } as const;

    expect(pageAudit(member, acting, event)).toEqual({
      channelId: 'channel-1',
      actorUserId: 'user-1',
      targetType: 'page',
      targetId: 'channel-1',
      ...event,
    });
    expect(pageAudit(viaToken, acting, event)).toMatchObject({ actorTokenId: 'token-1' });
  });
});
