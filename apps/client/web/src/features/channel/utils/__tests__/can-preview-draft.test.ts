import { listMyMemberships } from '@vp/api-contracts';
import { createQueryClient, type Session } from '@vp/queries';
import { account, api, apiServer, CHANNEL_ID, channel, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { canPreviewDraft } from '../can-preview-draft';

const OWNER = account();
const OTHER_CHANNEL = '0190c3a0-5e1d-7000-8000-00000000c0ff';
const OWNER_ID = channel().userId;

const signedIn = (actingChannelId?: string): Session => ({
  status: 'signed-in',
  account: OWNER,
  actingChannelId,
});

const memberOf = (channelId: string, role: 'editor' | 'moderator') =>
  mockEndpoint(listMyMemberships, () =>
    HttpResponse.json({
      items: [
        {
          channelId,
          ownerId: OWNER_ID,
          role,
          channel: { handle: 'other', displayName: 'Other', avatarUrl: null },
        },
      ],
    })
  );

const can = (auth: Session, id = CHANNEL_ID) =>
  canPreviewDraft({ queryClient: createQueryClient(), api, auth }, { id, userId: OWNER_ID });

describe('apps/client/web: canPreviewDraft', () => {
  beforeEach(() =>
    apiServer.use(mockEndpoint(listMyMemberships, () => HttpResponse.json({ items: [] })))
  );

  it('lets the owner preview the page of the channel they act on', async () => {
    await expect(can(signedIn())).resolves.toBe(true);
  });

  it.each([
    { scenario: 'a guest', auth: { status: 'guest' } as Session, id: CHANNEL_ID },
    {
      scenario: 'a session acting on another channel',
      auth: signedIn(OTHER_CHANNEL),
      id: CHANNEL_ID,
    },
    {
      scenario: 'the owner looking at a channel they do not act on',
      auth: signedIn(),
      id: OTHER_CHANNEL,
    },
  ])('refuses $scenario', async ({ auth, id }) => {
    await expect(can(auth, id)).resolves.toBe(false);
  });

  it.each([
    { role: 'editor' as const, allowed: true },
    { role: 'moderator' as const, allowed: false },
  ])('answers $allowed for a $role of the channel', async ({ role, allowed }) => {
    apiServer.use(memberOf(OTHER_CHANNEL, role));
    const member: Session = {
      status: 'signed-in',
      account: account({ user: { ...OWNER.user, id: '0190c3a0-5e1d-7000-8000-00000000b777' } }),
      actingChannelId: OTHER_CHANNEL,
    };

    await expect(can(member, OTHER_CHANNEL)).resolves.toBe(allowed);
  });
});
