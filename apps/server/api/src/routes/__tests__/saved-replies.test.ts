import { CHANNEL_HEADER } from '@vp/api-contracts';
import type { ChannelRole } from '@vp/domain';
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

const MISSING = '99999999-9999-7999-8999-999999999999';

describe('saved replies routes', () => {
  let ctx: CommentsApp;
  let channelId: string;

  const url = (id = '') => `/v1/me/channel/saved-replies${id && `/${id}`}`;
  const as = (who: Who) => ({ ...AS[who], [CHANNEL_HEADER]: channelId });
  const send = (
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    who: Who = 'creator',
    payload?: object
  ) => ctx.app.inject({ method, url: path, headers: as(who), payload });
  const save = async (title: string) =>
    (await send('POST', url(), 'creator', { title, body: `${title} body` })).json();

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

  it.each<{ role: ChannelRole | 'owner'; read: number; write: number }>([
    { role: 'owner', read: 200, write: 201 },
    { role: 'manager', read: 200, write: 201 },
    { role: 'moderator', read: 200, write: 403 },
    { role: 'editor', read: 403, write: 403 },
    { role: 'analytics', read: 403, write: 403 },
  ])(
    'answers a $role with $read for a read and $write for a write',
    async ({ role, read, write }) => {
      const who: Who = role === 'owner' ? 'creator' : 'stranger';
      if (role !== 'owner') {
        await seedTeamMember(ctx.repositories, { ownerId: CREATOR, memberId: STRANGER, role });
      }

      const listed = await send('GET', url(), who);
      const created = await send('POST', url(), who, { title: 'Thanks', body: 'Thank you!' });

      expect([listed.statusCode, created.statusCode]).toEqual([read, write]);
    }
  );

  it('saves, edits, moves and deletes a reply', async () => {
    const first = await save('One');
    await save('Two');

    const edited = await send('PATCH', url(first.id), 'creator', { body: 'Changed', position: 9 });
    const listed = await send('GET', url());
    const deleted = await send('DELETE', url(first.id));
    const after = await send('GET', url());

    expect(edited.json()).toMatchObject({
      id: first.id,
      title: 'One',
      body: 'Changed',
      position: 9,
    });
    expect(listed.json().items.map((item: { title: string }) => item.title)).toEqual([
      'Two',
      'One',
    ]);
    expect(deleted.statusCode).toBe(204);
    expect(after.json().items).toHaveLength(1);
  });

  it('refuses the 21st reply with 409', async () => {
    for (let n = 0; n < 20; n++) await save(`Reply ${n}`);

    const over = await send('POST', url(), 'creator', { title: 'One more', body: 'x' });

    expect(over.statusCode).toBe(409);
    expect(over.json()).toMatchObject({ code: 'SAVED_REPLY_LIMIT' });
  });

  it.each([
    { scenario: 'a title over 40 characters', payload: { title: 'x'.repeat(41), body: 'x' } },
    { scenario: 'a blank body', payload: { title: 'x', body: ' ' } },
  ])('refuses $scenario with 400', async ({ payload }) => {
    expect((await send('POST', url(), 'creator', payload)).statusCode).toBe(400);
  });

  it.each(['PATCH', 'DELETE'] as const)(
    'answers 404 for %s on an unknown reply',
    async (method) => {
      const response = await send(
        method,
        url(MISSING),
        'creator',
        method === 'PATCH' ? { title: 'x' } : undefined
      );

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ code: 'SAVED_REPLY_NOT_FOUND' });
    }
  );

  it('answers 401 for nobody', async () => {
    const anonymous = await ctx.app.inject({ method: 'GET', url: url() });

    expect(anonymous.statusCode).toBe(401);
  });
});
