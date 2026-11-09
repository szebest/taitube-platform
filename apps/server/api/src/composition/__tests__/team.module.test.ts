import { Adapters, registerAdapters } from '@vp/adapters/composition';
import { Container } from '@vp/composition';
import { inProcessAppConfig } from '@vp/env-schema';
import { expectOk } from '@vp/testing/result';
import { registerServices, Services } from '../services.module';

const OWNER = { id: '00000000-0000-7000-8000-00000000f511', role: 'USER' } as const;
const INVITEE = { id: '00000000-0000-7000-8000-00000000f512', role: 'USER' } as const;

describe('apps/server/api/composition: team module', () => {
  it('invites and joins through the repositories the rest of the API shares', async () => {
    const c = registerServices(await registerAdapters(new Container(), inProcessAppConfig()));
    const { channels } = c.get(Adapters.Repositories);
    expectOk(await channels.create({ userId: INVITEE.id, handle: 'ada', displayName: 'Ada' }));
    const { user, acting } = expectOk(await c.get(Services.RequestIdentity).resolve(OWNER));

    const invite = expectOk(
      await c
        .get(Services.ChannelInviteService)
        .create(user, expectOk(acting), { handle: 'ada', role: 'editor' })
    );
    expectOk(await c.get(Services.ChannelInviteService).accept(INVITEE, invite.id));

    expect(expectOk(await c.get(Services.ChannelMemberService).memberships(INVITEE)).items).toEqual(
      [expect.objectContaining({ channelId: expectOk(acting).channelId, role: 'editor' })]
    );
    expect(
      expectOk(
        await c.get(Services.ChannelAuditService).list(user, expectOk(acting), {})
      ).items.map(({ action }) => action)
    ).toEqual(['invite.accepted', 'invite.created']);
    expectOk(await c.dispose());
  });
});
