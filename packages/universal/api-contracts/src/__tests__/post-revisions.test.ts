import { ErrorCodes } from '@vp/errors';
import { listPostRevisions, restorePostRevision } from '../post-revisions';

describe('packages/api-contracts: post revisions', () => {
  it.each([
    { scenario: 'a version', body: { version: 3 }, ok: true },
    { scenario: 'version 0', body: { version: 0 }, ok: false },
    { scenario: 'no version', body: {}, ok: false },
  ])('reads $scenario as a restore body: $ok', ({ body, ok }) => {
    expect(restorePostRevision.body.safeParse(body).success).toBe(ok);
  });

  it('names the token scope and the acting channel on both routes', () => {
    expect(
      [listPostRevisions, restorePostRevision].map((route) => [route.scope, route.channelScoped])
    ).toEqual([
      ['posts:write', true],
      ['posts:write', true],
    ]);
  });

  it('answers a restore with the conflicts a stale version and a locked poll cause', () => {
    expect(restorePostRevision.errors[409]).toEqual([
      ErrorCodes.VERSION_CONFLICT,
      ErrorCodes.POST_POLL_LOCKED,
    ]);
    expect(restorePostRevision.errors[404]).toContain(ErrorCodes.REVISION_NOT_FOUND);
  });
});
