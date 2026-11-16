import { expectOk } from '@vp/testing/result';
import { z } from 'zod';
import { createFakeApi } from '../../__tests__/fake-api';
import { createFakePorts } from '../../__tests__/fake-ports';
import { createApi } from '../../api';
import { findRoot, hasReply, listReplies, listRoots, sameComment } from '../comment-lookup';

const ACTOR = { id: 'reader', role: 'user' };

function setup() {
  const fake = createFakeApi();
  return { api: createApi(createFakePorts({ fetch: fake.fetch }), 'http://api.test') };
}

describe('seed/scenarios: comment-lookup', () => {
  it('finds a root comment by author and text, and its replies', async () => {
    const { api } = setup();
    const root = expectOk(
      await api.send(
        {
          actor: { id: 'ann', role: 'user' },
          method: 'POST',
          path: '/v1/videos/v1/comments',
          json: { content: 'hello' },
        },
        z.object({ id: z.string() })
      )
    );
    await api.send(
      {
        actor: { id: 'bob', role: 'user' },
        method: 'POST',
        path: '/v1/videos/v1/comments',
        json: { content: 'hi back', parentId: root.id },
      },
      z.unknown()
    );

    expect(expectOk(await listRoots(api, ACTOR, 'v1'))).toHaveLength(1);
    expect(expectOk(await findRoot(api, ACTOR, 'v1', 'ann', 'hello'))?.id).toBe(root.id);
    expect(expectOk(await findRoot(api, ACTOR, 'v1', 'bob', 'hello'))).toBeNull();
    const replies = expectOk(await listReplies(api, ACTOR, root.id));
    expect(hasReply(replies, 'bob', 'hi back')).toBe(true);
    expect(hasReply(replies, 'ann', 'hi back')).toBe(false);
  });

  it('matches on both author and content', () => {
    const comment = { content: 'x', author: { userId: 'a' } } as never;

    expect(sameComment(comment, 'a', 'x')).toBe(true);
    expect(sameComment(comment, 'b', 'x')).toBe(false);
  });
});
