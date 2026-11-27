import { Paginator } from '@kit/pagination';
import { expectErr, expectOk } from '@kit/testing/result';
import type { PostPayload } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { PostRevisionService } from '../post-revision-service';
import { EDITOR_ID, MODERATOR_ID, OWNER, STRANGER, member, postsFixture } from './post-deps';

const POLL: PostPayload = { kind: 'poll', question: 'Q?', options: ['a', 'b'], closesAt: null };

async function setup() {
  const fixture = await postsFixture();
  const revisions = new PostRevisionService({
    posts: fixture.repositories.channelPosts,
    revisions: fixture.repositories.entityRevisions,
    editor: fixture.service,
    paginator: new Paginator(),
  });
  const edit = async (id: string, version: number, text: string) =>
    expectOk(
      await fixture.service.edit(OWNER, fixture.acting, id, {
        payload: { kind: 'text', text },
        version,
      })
    );
  return { ...fixture, revisions, edit };
}

describe('apps/server/api/services: PostRevisionService', () => {
  it('lists the state before the first edit and each edit, newest first, and pages by version', async () => {
    const { revisions, acting, publish, edit } = await setup();
    const post = await publish();
    const one = await edit(post.id, post.version, 'one');
    await edit(post.id, one.version, 'two');

    const all = expectOk(await revisions.list(OWNER, acting, post.id, {}));
    const first = expectOk(await revisions.list(OWNER, acting, post.id, { limit: 2 }));
    const rest = expectOk(
      await revisions.list(OWNER, acting, post.id, { cursor: first.nextCursor ?? undefined })
    );

    expect(all.items.map((item) => [item.version, item.payload])).toEqual([
      [3, { kind: 'text', text: 'two' }],
      [2, { kind: 'text', text: 'one' }],
      [1, { kind: 'text', text: 'hello' }],
    ]);
    expect(all.items[2]?.authorUserId).toBeNull();
    expect(all.items[0]?.authorUserId).toBe(OWNER.id);
    expect([first.items.length, rest.items.length]).toEqual([2, 1]);
  });

  it('keeps no history for a draft and shows "edited" on the public post after an edit', async () => {
    const { revisions, service, acting, publish, edit } = await setup();
    const draft = expectOk(
      await service.create(OWNER, acting, {
        payload: { kind: 'text', text: 'wip' },
        commentsEnabled: true,
        timing: { mode: 'draft' },
      })
    );
    await edit(draft.id, draft.version, 'wip 2');
    const post = await publish();
    const before = expectOk(await service.get(null, post.id));
    await edit(post.id, post.version, 'changed');

    const after = expectOk(await service.get(null, post.id));

    expect(expectOk(await revisions.list(OWNER, acting, draft.id, {})).items).toEqual([]);
    expect([before.isEdited, after.isEdited]).toEqual([false, true]);
  });

  it('restores an earlier state as a new edit that records its origin, and refuses a stale version', async () => {
    const { revisions, service, acting, publish, edit } = await setup();
    const post = await publish();
    const one = await edit(post.id, post.version, 'one');
    await edit(post.id, one.version, 'two');
    const original = expectOk(await revisions.list(OWNER, acting, post.id, {})).items.at(-1);

    const stale = expectErr(await revisions.restore(OWNER, acting, post.id, original?.id ?? '', 1));
    const restored = expectOk(
      await revisions.restore(OWNER, acting, post.id, original?.id ?? '', 3)
    );
    const history = expectOk(await revisions.list(OWNER, acting, post.id, {}));

    expect(stale.code).toBe(ErrorCodes.VERSION_CONFLICT);
    expect(restored).toMatchObject({ version: 4, body: { text: 'hello' } });
    expect(history.items[0]).toMatchObject({ version: 4, restoredFromVersion: 1 });
    expect(expectOk(await service.get(null, post.id)).body).toMatchObject({ text: 'hello' });
  });

  it('refuses to restore a poll to different options once it has votes', async () => {
    const { revisions, service, engagementService, acting, publish } = await setup();
    const post = await publish(POLL);
    const widened = expectOk(
      await service.edit(OWNER, acting, post.id, {
        payload: { ...POLL, options: ['a', 'b', 'c'] },
        version: post.version,
      })
    );
    expectOk(await engagementService.vote({ id: 'voter-1', role: 'USER' }, post.id, 0));
    const original = expectOk(await revisions.list(OWNER, acting, post.id, {})).items.at(-1);

    const failure = expectErr(
      await revisions.restore(OWNER, acting, post.id, original?.id ?? '', widened.version)
    );

    expect(failure.code).toBe(ErrorCodes.POST_POLL_LOCKED);
  });

  it.each([
    { who: 'an editor', user: member(EDITOR_ID, 'ch', 'editor'), ok: true },
    { who: 'a moderator', user: member(MODERATOR_ID, 'ch', 'moderator'), ok: false },
    { who: 'a stranger', user: STRANGER, ok: false },
  ])('answers $who: $ok', async ({ user, ok }) => {
    const { revisions, acting, publish } = await setup();
    const post = await publish();
    const role = user.memberships?.ch?.role;
    const as = role ? member(user.id, acting.channelId, role) : user;

    const result = await revisions.list(as, acting, post.id, {});

    expect(result.ok).toBe(ok);
  });

  it('answers REVISION_NOT_FOUND for a revision of another post and POST_NOT_FOUND for a missing post', async () => {
    const { revisions, acting, publish, edit } = await setup();
    const a = await publish();
    const b = await publish();
    await edit(a.id, a.version, 'x');
    const ofA = expectOk(await revisions.list(OWNER, acting, a.id, {})).items[0];

    expect(expectErr(await revisions.restore(OWNER, acting, b.id, ofA?.id ?? '', 1)).code).toBe(
      ErrorCodes.REVISION_NOT_FOUND
    );
    expect(
      expectErr(await revisions.list(OWNER, acting, '00000000-0000-7000-8000-0000000012aa', {}))
        .code
    ).toBe(ErrorCodes.POST_NOT_FOUND);
  });
});
