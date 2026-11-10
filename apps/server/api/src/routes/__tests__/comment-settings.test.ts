import { CHANNEL_HEADER } from '@vp/api-contracts';
import { type ChannelRole, DEFAULT_COMMENT_SETTINGS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { expectOk } from '@vp/testing/result';
import {
  AS,
  CREATOR,
  STRANGER,
  type CommentsApp,
  type Who,
  buildCommentsApp,
} from '../../__tests__/comments-app';
import { seedTeamMember } from '../../__tests__/test-app';

const SETTINGS_URL = '/v1/me/channel/comment-settings';
const SETTINGS = { ...DEFAULT_COMMENT_SETTINGS };

describe('comment settings routes', () => {
  let ctx: CommentsApp;
  let channelId: string;

  const putSettings = (changes: Partial<typeof SETTINGS>, who: Who = 'creator', channel?: string) =>
    ctx.app.inject({
      method: 'PUT',
      url: SETTINGS_URL,
      headers: { ...AS[who], ...(channel && { [CHANNEL_HEADER]: channel }) },
      payload: { ...SETTINGS, ...changes },
    });

  const configure = async (changes: Partial<typeof SETTINGS>) => {
    expect((await putSettings(changes)).statusCode).toBe(200);
  };

  beforeEach(async () => {
    ctx = await buildCommentsApp();
    channelId = expectOk(
      await ctx.repositories.channels.create({
        userId: CREATOR,
        handle: 'creator',
        displayName: 'Creator',
      })
    ).id;
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  it('answers the defaults for a channel that never saved', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: SETTINGS_URL, headers: AS.creator });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(DEFAULT_COMMENT_SETTINGS);
  });

  it.each<{ role: ChannelRole | 'owner'; status: number }>([
    { role: 'owner', status: 200 },
    { role: 'manager', status: 200 },
    { role: 'moderator', status: 403 },
    { role: 'editor', status: 403 },
    { role: 'analytics', status: 403 },
  ])('answers a $role reading and replacing them with $status', async ({ role, status }) => {
    const who: Who = role === 'owner' ? 'creator' : 'stranger';
    if (role !== 'owner') {
      await seedTeamMember(ctx.repositories, { ownerId: CREATOR, memberId: STRANGER, role });
    }
    const headers = { ...AS[who], [CHANNEL_HEADER]: channelId };

    const read = await ctx.app.inject({ method: 'GET', url: SETTINGS_URL, headers });
    const write = await putSettings({ subscribersOnly: true }, who, channelId);

    expect([read.statusCode, write.statusCode]).toEqual([status, status]);
  });

  it('records the fields that changed in the channel audit log and nothing for a repeat', async () => {
    await configure({ blockedWords: ['spoiler'], slowModeSeconds: 30 });
    await configure({ blockedWords: ['spoiler'], slowModeSeconds: 30 });

    const log = expectOk(
      await ctx.repositories.channelAudit.list(channelId, { cursor: null, limit: 10 })
    );
    expect(log).toMatchObject([
      {
        actorUserId: CREATOR,
        action: 'settings.comments.updated',
        targetId: channelId,
        meta: { fields: ['blockedWords', 'slowModeSeconds'] },
      },
    ]);
  });

  it.each([
    { scenario: 'a one character blocked word', changes: { blockedWords: ['a'] } },
    { scenario: 'a slow mode that is no preset', changes: { slowModeSeconds: 7 } },
    { scenario: 'an account age past the maximum', changes: { minAccountAgeDays: 31 } },
  ])('refuses $scenario with 422', async ({ changes }) => {
    const res = await putSettings(changes);

    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe(ErrorCodes.VALIDATION_FAILED);
  });

  it('refuses an anonymous caller with 401', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: SETTINGS_URL });

    expect(res.statusCode).toBe(401);
  });
});
