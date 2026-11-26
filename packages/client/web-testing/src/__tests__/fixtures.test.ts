import {
  getAccount,
  getChannel,
  getClip,
  getFeed,
  getCreatorStats,
  getVideo,
  heartComment,
  listCreatorComments,
  listMyIdentities,
  listMySubscriptions,
  recordMySignIn,
} from '@vp/api-contracts';
import {
  account,
  channel,
  clip,
  comment,
  creatorStats,
  feedPages,
  identities,
  inboxComment,
  signInRecord,
  subscribedChannel,
  video,
  videoSummary,
} from '../fixtures';

describe('@vp/web-testing: fixtures', () => {
  it.each([
    { fixture: 'video', contract: getVideo, body: video() },
    { fixture: 'clip', contract: getClip, body: clip() },
    { fixture: 'creatorStats', contract: getCreatorStats, body: creatorStats() },
    { fixture: 'channel', contract: getChannel, body: channel() },
    { fixture: 'account', contract: getAccount, body: account() },
    { fixture: 'signInRecord', contract: recordMySignIn, body: signInRecord() },
    { fixture: 'identities', contract: listMyIdentities, body: identities() },
    { fixture: 'comment', contract: heartComment, body: comment() },
    {
      fixture: 'inboxComment',
      contract: listCreatorComments,
      body: { items: [inboxComment()], nextCursor: null },
    },
    { fixture: 'feedPages', contract: getFeed, body: feedPages([videoSummary()]).pages[0] },
    {
      fixture: 'videoSummary of an owner with no channel',
      contract: getFeed,
      body: feedPages([videoSummary({ channel: null })]).pages[0],
    },
    {
      fixture: 'subscribedChannel',
      contract: listMySubscriptions,
      body: { items: [subscribedChannel()], nextCursor: null },
    },
  ])('builds a $fixture the API contract accepts', ({ contract, body }) => {
    expect(contract.result.safeParse(body).success).toBe(true);
  });
});
