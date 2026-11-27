import { expectErr, expectOk } from '@kit/testing/result';
import type { GenerationStatus, VideoEdit, VideoGeneration } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { aVideo } from '../../__tests__/entities';
import { decideEditBase, decideEditRevert, decideGenerationStart } from '../decide-generation.rule';

const generation = (status: GenerationStatus): VideoGeneration => ({
  videoId: 'video-1',
  generation: 2,
  kind: 'replacement',
  status,
  sourceKey: null,
  baseGeneration: 1,
  replacesGeneration: 1,
  playback: null,
  timeline: null,
  retention: null,
  needsReview: false,
  errorCode: null,
  purgeAfter: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});

const editOf = (
  generationNumber: number,
  base: number,
  status: GenerationStatus = 'active'
): VideoGeneration => ({
  ...generation(status),
  generation: generationNumber,
  kind: 'edit',
  baseGeneration: base,
});

const edit = (overrides: Partial<VideoEdit> = {}): VideoEdit => ({
  videoId: 'video-1',
  baseGeneration: 1,
  generation: 2,
  status: 'applied',
  trim: { startMs: 0, endMs: 500 },
  blurs: [],
  updatedAt: new Date(0),
  ...overrides,
});

describe('@vp/domain-rules: decideGenerationStart', () => {
  it.each(['failed', 'retired', 'purged', 'active'] as const)(
    'starts beside a %s generation',
    (status) => {
      const video = aVideo();
      expect(expectOk(decideGenerationStart(video, [generation(status)]))).toBe(video);
    }
  );

  it.each(['uploading', 'rendering'] as const)('refuses beside a %s one', (status) => {
    expect(expectErr(decideGenerationStart(aVideo(), [generation(status)])).code).toBe(
      ErrorCodes.GENERATION_IN_PROGRESS
    );
  });

  it.each(['PROCESSING', 'FAILED', 'HELD'] as const)('refuses a %s video', (status) => {
    expect(expectErr(decideGenerationStart(aVideo({ status }), [])).code).toBe(
      ErrorCodes.VALIDATION_FAILED
    );
  });
});

describe('@vp/domain-rules: decideEditRevert', () => {
  it.each([
    { shape: 'the edit that plays', generations: [editOf(2, 1)] },
    {
      shape: 'the edit that plays after a later edit failed',
      generations: [editOf(3, 1, 'failed'), editOf(2, 1)],
    },
  ])('reverts $shape to its base', ({ generations }) => {
    expect(expectOk(decideEditRevert(aVideo({ generation: 2 }), generations))).toEqual({
      baseGeneration: 1,
    });
  });

  it.each([
    { shape: 'no edit playing', video: aVideo({ generation: 2 }), generations: [] },
    {
      shape: 'while a later edit renders',
      video: aVideo({ generation: 2 }),
      generations: [editOf(3, 1, 'rendering'), editOf(2, 1)],
    },
    {
      shape: 'the base playing after a revert',
      video: aVideo({ generation: 1 }),
      generations: [editOf(2, 1, 'retired')],
    },
    {
      shape: 'a replacement playing over the edit',
      video: aVideo({ generation: 3 }),
      generations: [{ ...generation('active'), generation: 3 }, editOf(2, 1, 'retired')],
    },
    {
      shape: 'an edit baked into its base',
      video: aVideo({ generation: 2 }),
      generations: [editOf(2, 2)],
    },
  ])('refuses $shape', ({ video, generations }) => {
    expect(expectErr(decideEditRevert(video, generations)).code).toBe(ErrorCodes.NO_EDIT_TO_REVERT);
  });
});

describe('@vp/domain-rules: decideEditBase', () => {
  it.each([
    {
      shape: 'no edit yet',
      video: aVideo({ generation: 4 }),
      current: null,
      generations: [],
      base: 4,
    },
    {
      shape: 'the base playing after a revert',
      video: aVideo({ generation: 1 }),
      current: edit(),
      generations: [],
      base: 1,
    },
    {
      shape: 'an edit of the base playing',
      video: aVideo({ generation: 3 }),
      current: edit({ generation: 4, status: 'failed' }),
      generations: [editOf(3, 1)],
      base: 1,
    },
    {
      shape: 'a replacement playing',
      video: aVideo({ generation: 5 }),
      current: edit(),
      generations: [{ ...generation('active'), generation: 5 }],
      base: 5,
    },
  ])('renders from the right generation with $shape', ({ video, current, generations, base }) => {
    expect(decideEditBase(video, current, generations)).toBe(base);
  });
});
