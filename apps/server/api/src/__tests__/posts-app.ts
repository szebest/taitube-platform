import { expectOk } from '@kit/testing/result';
import { CHANNEL_HEADER, type PostWriteBody } from '@vp/api-contracts';
import { mintToken } from '@vp/dev-identity';
import type { ChannelRole } from '@vp/domain';
import type { LightMyRequestResponse } from 'fastify';
import { type TestApp, bearer, seedTeamMember, seedVideo } from './test-app';

export const OWNER = '11111111-1111-7111-8111-111111111111';
export const EDITOR = '22222222-2222-7222-8222-222222222222';
export const MODERATOR = '33333333-3333-7333-8333-333333333333';
export const STRANGER = '44444444-4444-7444-8444-444444444444';
export const FAN = '55555555-5555-7555-8555-555555555555';
export const VIDEO = '66666666-6666-7666-8666-666666666666';
export const PRIVATE_VIDEO = '77777777-7777-7777-8777-777777777777';
export const ABSENT = '99999999-9999-7999-8999-999999999999';

const INVITES: Record<string, string> = {
  [EDITOR]: '00000000-0000-7000-8000-0000000012e1',
  [MODERATOR]: '00000000-0000-7000-8000-0000000012e2',
};

const AS = {
  owner: bearer(mintToken({ sub: OWNER, role: 'USER', ttl: '1h' })),
  editor: bearer(mintToken({ sub: EDITOR, role: 'USER', ttl: '1h' })),
  moderator: bearer(mintToken({ sub: MODERATOR, role: 'USER', ttl: '1h' })),
  stranger: bearer(mintToken({ sub: STRANGER, role: 'USER', ttl: '1h' })),
  fan: bearer(mintToken({ sub: FAN, role: 'USER', ttl: '1h' })),
  anonymous: {},
};

type Who = keyof typeof AS;
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface PostsApp extends TestApp {
  ownerChannelId: string;
  fanChannelId: string;
  /** `as` works on the owner channel through the header the team members send. */
  call(
    who: Who,
    method: Method,
    url: string,
    options?: { payload?: object; as?: string }
  ): Promise<LightMyRequestResponse>;
  publish(who: Who, body: PostWriteBody, as?: string): Promise<LightMyRequestResponse>;
  text(who: Who, text: string): Promise<string>;
  join(role: ChannelRole, userId: string): Promise<void>;
}

export const textBody = (text: string): PostWriteBody => ({
  payload: { kind: 'text', text },
  commentsEnabled: true,
});

/** An owner with a channel and public and private videos, a fan with a channel, and a caller of every kind. */
export async function seedPostsApp(testApp: TestApp): Promise<PostsApp> {
  const { app, repositories } = testApp;
  for (const id of [OWNER, EDITOR, MODERATOR, STRANGER, FAN]) {
    await repositories.users.upsert({
      id,
      email: `${id.slice(0, 4)}@example.com`,
      role: 'USER',
      tier: 'free',
    });
  }
  const owner = expectOk(
    await repositories.channels.create({ userId: OWNER, handle: 'owner', displayName: 'Owner' })
  );
  const fan = expectOk(
    await repositories.channels.create({ userId: FAN, handle: 'fan', displayName: 'Fan' })
  );
  await seedVideo(repositories, { id: VIDEO, ownerId: OWNER, title: 'Open' });
  await seedVideo(repositories, {
    id: PRIVATE_VIDEO,
    ownerId: OWNER,
    title: 'Closed',
    visibility: 'private',
  });

  const call: PostsApp['call'] = (who, method, url, { payload, as } = {}) =>
    app.inject({
      method,
      url,
      headers: { ...AS[who], ...(as && { [CHANNEL_HEADER]: as }) },
      ...(payload && { payload }),
    });
  const publish: PostsApp['publish'] = (who, body, as) =>
    call(who, 'POST', '/v1/me/channel/posts', { payload: body, as });

  return {
    ...testApp,
    ownerChannelId: owner.id,
    fanChannelId: fan.id,
    call,
    publish,
    text: async (who, text) => {
      const res = await publish(who, textBody(text));
      expect(res.statusCode).toBe(201);
      return res.json().id;
    },
    join: async (role, userId) => {
      await seedTeamMember(repositories, {
        ownerId: OWNER,
        memberId: userId,
        role,
        inviteId: INVITES[userId],
      });
    },
  };
}
