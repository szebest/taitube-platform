import { isErr, isOk } from '@kit/result';
import { type LinkAnchors, NO_ANCHORS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { type AnchorSide, decideLinkAnchors } from '../link-anchors.rule';

const video: AnchorSide = { type: 'video', durationMs: 300_000 };
const post: AnchorSide = { type: 'post', durationMs: null };

describe('@vp/domain-rules: decideLinkAnchors', () => {
  it.each<{ scenario: string; anchors: Partial<LinkAnchors>; target?: AnchorSide }>([
    { scenario: 'no anchors', anchors: {} },
    { scenario: 'a timestamp at 3:21', anchors: { targetStartMs: 201_000 } },
    {
      scenario: 'a span to a span',
      anchors: {
        sourceStartMs: 10_000,
        sourceEndMs: 25_000,
        targetStartMs: 120_000,
        targetEndMs: 135_000,
      },
    },
    { scenario: 'no anchor on a post', anchors: {}, target: post },
  ])('accepts $scenario', ({ anchors, target }) => {
    const result = decideLinkAnchors({
      anchors: { ...NO_ANCHORS, ...anchors },
      source: video,
      target: target ?? video,
    });
    expect(isOk(result)).toBe(true);
  });

  it.each<{
    scenario: string;
    anchors: Partial<LinkAnchors>;
    target?: AnchorSide;
    side: 'source' | 'target';
  }>([
    {
      scenario: 'an end before its start',
      anchors: { sourceStartMs: 20_000, sourceEndMs: 10_000 },
      side: 'source',
    },
    { scenario: 'an end without a start', anchors: { targetEndMs: 10_000 }, side: 'target' },
    {
      scenario: 'a start past the end of the video',
      anchors: { targetStartMs: 400_000 },
      side: 'target',
    },
    { scenario: 'a negative start', anchors: { sourceStartMs: -1 }, side: 'source' },
    {
      scenario: 'an anchor on a post',
      anchors: { targetStartMs: 1_000 },
      target: post,
      side: 'target',
    },
  ])('refuses $scenario on the $side', ({ anchors, target, side }) => {
    const result = decideLinkAnchors({
      anchors: { ...NO_ANCHORS, ...anchors },
      source: video,
      target: target ?? video,
    });
    expect(isErr(result) && result.error).toMatchObject({
      code: ErrorCodes.LINK_ANCHOR_INVALID,
      side,
    });
  });
});
