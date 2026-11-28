import { isErr, isOk } from '@kit/result';
import type { ContentLinkRelation, ContentRef } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { decideLinkPair } from '../link-pair.rule';

const video = (id: string): ContentRef => ({ type: 'video', id });
const post: ContentRef = { type: 'post', id: 'p1' };

describe('@vp/domain-rules: decideLinkPair', () => {
  it.each<{
    scenario: string;
    relation: ContentLinkRelation;
    source: ContentRef;
    target: ContentRef;
    across: boolean;
  }>([
    {
      scenario: 'a Short to its full video',
      relation: 'full_video',
      source: video('s'),
      target: video('v'),
      across: false,
    },
    {
      scenario: 'a cross-channel response',
      relation: 'response_to',
      source: video('a'),
      target: video('b'),
      across: true,
    },
    {
      scenario: 'a post discussing a video elsewhere',
      relation: 'discussion',
      source: post,
      target: video('v'),
      across: true,
    },
    {
      scenario: 'a related playlist',
      relation: 'related',
      source: { type: 'playlist', id: 'pl' },
      target: video('v'),
      across: true,
    },
  ])('allows $scenario', ({ relation, source, target, across }) => {
    const result = decideLinkPair({
      relation,
      source,
      target,
      sourceChannelId: 'c1',
      targetChannelId: across ? 'c2' : 'c1',
    });
    expect(isOk(result)).toBe(true);
  });

  it.each<{
    scenario: string;
    relation: ContentLinkRelation;
    source: ContentRef;
    target: ContentRef;
    across: boolean;
    code: string;
  }>([
    {
      scenario: 'a self link',
      relation: 'related',
      source: video('v'),
      target: video('v'),
      across: false,
      code: ErrorCodes.LINK_SELF,
    },
    {
      scenario: 'a post as a full video source',
      relation: 'full_video',
      source: post,
      target: video('v'),
      across: false,
      code: ErrorCodes.LINK_PAIR_NOT_ALLOWED,
    },
    {
      scenario: 'a stored clip_of',
      relation: 'clip_of',
      source: { type: 'clip', id: 'c' },
      target: video('v'),
      across: false,
      code: ErrorCodes.LINK_PAIR_NOT_ALLOWED,
    },
    {
      scenario: 'a recap across channels',
      relation: 'recap',
      source: video('a'),
      target: video('b'),
      across: true,
      code: ErrorCodes.LINK_RELATION_SAME_CHANNEL,
    },
    {
      scenario: 'a previous link across channels',
      relation: 'previous',
      source: video('a'),
      target: video('b'),
      across: true,
      code: ErrorCodes.LINK_RELATION_SAME_CHANNEL,
    },
  ])('refuses $scenario with $code', ({ relation, source, target, across, code }) => {
    const result = decideLinkPair({
      relation,
      source,
      target,
      sourceChannelId: 'c1',
      targetChannelId: across ? 'c2' : 'c1',
    });
    expect(isErr(result) && result.error.code).toBe(code);
  });
});
