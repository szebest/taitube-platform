import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { SavedReplyService } from '../saved-reply-service';

const OWNER: UserContext = { id: '11111111-1111-7111-8111-111111111111', role: 'CREATOR' };

describe('apps/server/api/services: saved replies', () => {
  let service: SavedReplyService;
  let acting: { channelId: string; ownerId: string; role: 'owner' };
  const draft = { title: 'Thanks', body: 'Thank you!' };

  beforeEach(async () => {
    const repositories = new InMemoryRepositories();
    const channel = expectOk(
      await repositories.channels.create({
        userId: OWNER.id,
        handle: 'owner',
        displayName: 'Owner',
      })
    );
    acting = { channelId: channel.id, ownerId: OWNER.id, role: 'owner' };
    service = new SavedReplyService({ replies: repositories.savedReplies });
  });

  it('serves the view without the channel', async () => {
    expectOk(await service.create(OWNER, acting, draft));

    expect(expectOk(await service.list(OWNER, acting)).items).toMatchObject([
      { ...draft, position: 0 },
    ]);
    expect(expectOk(await service.list(OWNER, acting)).items[0]).not.toHaveProperty('channelId');
  });

  it('refuses the 21st reply and an unknown one', async () => {
    for (let n = 0; n < 20; n++) expectOk(await service.create(OWNER, acting, draft));

    const over = await service.create(OWNER, acting, draft);
    const missing = await service.remove(OWNER, acting, '99999999-9999-7999-8999-999999999999');

    expect([expectErr(over).code, expectErr(missing).code]).toEqual([
      ErrorCodes.SAVED_REPLY_LIMIT,
      ErrorCodes.SAVED_REPLY_NOT_FOUND,
    ]);
  });
});
