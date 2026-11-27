import { ErrorCodes } from '@vp/errors';
import {
  getPostStats,
  listManagedPosts,
  pinPost,
  recordPostOpen,
  recordPostShareClick,
  unpinPost,
  votePost,
} from '../post-studio';

describe('packages/api-contracts: post studio endpoints', () => {
  it.each([
    { scenario: 'a first option', body: { optionIndex: 0 }, ok: true },
    { scenario: 'a fractional option', body: { optionIndex: 0.5 }, ok: false },
    { scenario: 'no option', body: {}, ok: false },
  ])('reads $scenario as a vote body: $ok', ({ body, ok }) => {
    expect(votePost.body.safeParse(body).success).toBe(ok);
  });

  it.each([
    { scenario: 'a status', query: { status: 'draft' }, ok: true },
    { scenario: 'no status', query: {}, ok: true },
    { scenario: 'an unknown status', query: { status: 'gone' }, ok: false },
  ])('reads $scenario as a studio list query: $ok', ({ query, ok }) => {
    expect(listManagedPosts.query.safeParse(query).success).toBe(ok);
  });

  it('answers the vote with the conflicts a second vote and a closed poll cause', () => {
    expect(votePost.errors[409]).toEqual([
      ErrorCodes.POST_ALREADY_VOTED,
      ErrorCodes.POST_POLL_CLOSED,
    ]);
    expect(votePost.errors[403]).toContain(ErrorCodes.COMMENTS_BANNED);
  });

  it('answers the fourth pin with a conflict and names the token scope on both pin routes', () => {
    expect(pinPost.errors[409]).toEqual([ErrorCodes.POST_PIN_LIMIT]);
    expect([pinPost.scope, unpinPost.scope]).toEqual(['posts:write', 'posts:write']);
  });

  it('keeps the stats and the studio list out of a token and on the acting channel', () => {
    expect([getPostStats, listManagedPosts].map((route) => 'scope' in route)).toEqual([
      false,
      false,
    ]);
    expect([getPostStats, listManagedPosts].map((route) => route.channelScoped)).toEqual([
      true,
      true,
    ]);
  });

  it('lets an anonymous reader send the open and share beacons', () => {
    expect(
      [recordPostOpen, recordPostShareClick].map((route) => [route.anonymous, route.status])
    ).toEqual([
      [true, 204],
      [true, 204],
    ]);
  });

  it('keeps the stats off a public post', () => {
    expect(JSON.stringify(votePost.result.toJSONSchema())).not.toContain('shareClicks');
  });
});
