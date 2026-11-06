import { channel, video } from '@vp/web-testing';

import { toSummary } from '../to-summary';

const { id, handle, displayName, avatarUrl } = channel();

describe('apps/client/web: toSummary', () => {
  it.each([
    { scenario: 'a video with no channel', owner: undefined, expected: null },
    {
      scenario: 'a video with a channel',
      owner: { id, handle, displayName, avatarUrl },
      expected: { id, handle, displayName, avatarUrl },
    },
  ])('gives $scenario its channel, or null', ({ owner, expected }) => {
    expect(toSummary(video({ channel: owner })).channel).toEqual(expected);
  });
});
