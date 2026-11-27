import { expectErr, expectOk } from '@kit/testing/result';
import type { PostPayload } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { NOW, OWNER, postsFixture } from './post-deps';

const DAY = 86_400_000;
const POLL: PostPayload = { kind: 'poll', question: 'Best?', options: ['a', 'b'], closesAt: null };
const later = (days: number) => new Date(NOW + days * DAY).toISOString();

async function draftOf() {
  const fixture = await postsFixture();
  const draft = expectOk(
    await fixture.service.create(OWNER, fixture.acting, {
      payload: { kind: 'text', text: 'hello' },
      commentsEnabled: true,
      timing: { mode: 'draft' },
    })
  );
  return { ...fixture, draft };
}

describe('apps/server/api/services: editPost', () => {
  it('keeps a draft a draft when the edit names no timing, and does not mark it edited publicly', async () => {
    const { service, acting, draft } = await draftOf();

    const edited = expectOk(
      await service.edit(OWNER, acting, draft.id, {
        payload: { kind: 'text', text: 'changed' },
        version: draft.version,
      })
    );

    expect(edited).toMatchObject({ status: 'draft', body: { text: 'changed' } });
  });

  it.each([
    {
      scenario: 'scheduled',
      timing: { mode: 'schedule', publishAt: later(2) } as const,
      status: 'scheduled',
    },
    { scenario: 'kept as a draft', timing: { mode: 'draft' } as const, status: 'draft' },
  ])('moves a draft to $scenario', async ({ timing, status }) => {
    const { service, acting, draft } = await draftOf();

    const moved = expectOk(
      await service.edit(OWNER, acting, draft.id, {
        payload: { kind: 'text', text: 'hello' },
        version: draft.version,
        timing,
      })
    );

    expect(moved.status).toBe(status);
  });

  it('publishes a draft now, tells subscribers once and refuses to publish it a second time', async () => {
    const { service, acting, draft, repositories } = await draftOf();

    const published = expectOk(
      await service.edit(OWNER, acting, draft.id, {
        payload: { kind: 'text', text: 'hello' },
        version: draft.version,
        timing: { mode: 'now' },
      })
    );

    expect(published).toMatchObject({ status: 'published' });
    expect(expectOk(await service.get(null, draft.id)).id).toBe(draft.id);
    expect(expectOk(await repositories.outbox.claimBatch(10))).toHaveLength(1);
  });

  it('refuses to schedule or draft a published post', async () => {
    const { service, acting, publish } = await postsFixture();
    const post = await publish();

    const failure = expectErr(
      await service.edit(OWNER, acting, post.id, {
        payload: { kind: 'text', text: 'x' },
        version: post.version,
        timing: { mode: 'draft' },
      })
    );

    expect(failure).toMatchObject({
      code: ErrorCodes.POST_SCHEDULE_INVALID,
      reason: 'already_published',
    });
  });

  it('locks the options of a poll after the first vote but lets the close time move', async () => {
    const { service, acting, publish, engagementService } = await postsFixture();
    const poll = await publish(POLL);
    expectOk(await engagementService.vote({ id: 'voter-1', role: 'USER' }, poll.id, 0));

    const reworded = expectErr(
      await service.edit(OWNER, acting, poll.id, {
        payload: { ...POLL, options: ['a', 'x'] },
        version: poll.version,
      })
    );
    const closing = expectOk(
      await service.edit(OWNER, acting, poll.id, {
        payload: { ...POLL, closesAt: later(3) },
        version: poll.version,
      })
    );

    expect(reworded.code).toBe(ErrorCodes.POST_POLL_LOCKED);
    expect(closing.body).toMatchObject({ kind: 'poll', closesAt: later(3) });
  });

  it('lets the options of a poll change while nobody voted', async () => {
    const { service, acting, publish } = await postsFixture();
    const poll = await publish(POLL);

    const edited = expectOk(
      await service.edit(OWNER, acting, poll.id, {
        payload: { ...POLL, options: ['a', 'b', 'c'] },
        version: poll.version,
      })
    );

    expect(edited.body).toMatchObject({ options: [{ text: 'a' }, { text: 'b' }, { text: 'c' }] });
  });

  it('lets a poll that has closed be edited without asking for its close time again', async () => {
    let now = NOW;
    const { service, acting, publish } = await postsFixture(() => now);
    const poll = await publish({ ...POLL, closesAt: later(1) });
    now = NOW + 2 * DAY;

    const edited = expectOk(
      await service.edit(OWNER, acting, poll.id, {
        payload: { ...POLL, question: 'Reworded?', closesAt: later(1) },
        version: poll.version,
      })
    );

    expect(edited.body).toMatchObject({ question: 'Reworded?', closed: true });
  });
});
