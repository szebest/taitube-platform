import { ErrorCodes } from '@vp/errors';
import type { Result } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import {
  FRAME_KEY,
  HELD_ID,
  MODERATOR_A,
  MODERATOR_B,
  ORIGINAL_ID,
  OWNER,
  SCREENING_ID,
  STRANGER,
  screeningHarness,
} from './screening-harness';

const partialMatch = {
  reason: 'PARTIAL_MATCH' as const,
  score: 0.4,
  evidence: { matchedVideoId: ORIGINAL_ID },
};

const codeOf = <E extends { code: string }>(result: Result<unknown, E>) => expectErr(result).code;

describe('apps/server/api/services: screening', () => {
  let h: ReturnType<typeof screeningHarness>;

  beforeEach(async () => {
    h = screeningHarness();
    await h.seedHeld();
  });

  describe('the queue', () => {
    it('shows the score, reasons, matched video with its ranges, and the flagged frame as a signed url', async () => {
      const { items } = expectOk(await h.service.queue(MODERATOR_A, {}));

      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        id: SCREENING_ID,
        videoId: HELD_ID,
        title: 'A copy',
        status: 'HELD',
        outcome: 'HOLD',
        score: 0.97,
        open: true,
        decision: null,
        appeal: null,
      });
      expect(items[0]?.reasons[0]).toMatchObject({
        reason: 'DUPLICATE',
        match: {
          id: ORIGINAL_ID,
          title: 'The original',
          channel: { handle: 'original' },
          status: 'READY',
          sameChannel: false,
          mirrored: true,
          videoCoverage: 0.97,
          sourceRange: { fromSeconds: 10, toSeconds: 70 },
          matchedRange: { fromSeconds: 15, toSeconds: 75 },
        },
      });
      expect(items[0]?.reasons[1]).toMatchObject({
        reason: 'NSFW',
        flaggedShare: 0.4,
        frames: [{ timestampSeconds: 12, score: 0.93 }],
      });
      expect(items[0]?.reasons[1]?.frames[0]?.url).toContain(FRAME_KEY);
    });

    it('leaves the frames out once the evidence was removed', async () => {
      expectOk(
        await h.repositories.screenings.reject({
          videoId: HELD_ID,
          moderatorId: MODERATOR_A.id,
          reason: 'no',
        })
      );
      expectOk(await h.repositories.screenings.markEvidencePurged(SCREENING_ID));

      const { items } = expectOk(await h.service.queue(MODERATOR_A, {}));

      expect(items[0]?.reasons[1]?.frames).toEqual([]);
    });

    it.each([
      { name: 'a stranger', actor: STRANGER, code: ErrorCodes.FORBIDDEN },
      { name: 'the owner', actor: OWNER, code: ErrorCodes.FORBIDDEN },
    ])('refuses $name', async ({ actor, code }) => {
      expect(codeOf(await h.service.queue(actor, {}))).toBe(code);
    });

    it('lists decided cases after open ones and filters by state', async () => {
      expectOk(await h.service.approve(MODERATOR_A, HELD_ID));

      const all = expectOk(await h.service.queue(MODERATOR_A, {}));
      const open = expectOk(await h.service.queue(MODERATOR_A, { state: 'open' }));

      expect(all.items.map((item) => [item.id, item.open])).toEqual([[SCREENING_ID, false]]);
      expect(open.items).toEqual([]);
    });

    it('rejects a broken cursor', async () => {
      expect(codeOf(await h.service.queue(MODERATOR_A, { cursor: 'nonsense' }))).toBe(
        ErrorCodes.INVALID_CURSOR
      );
    });
  });

  describe('approve', () => {
    it('moves a held video to processing, enqueues its package job once, and writes the event', async () => {
      const decided = expectOk(await h.service.approve(MODERATOR_A, HELD_ID));

      expect(decided).toEqual({ videoId: HELD_ID, status: 'PROCESSING' });
      expect(await h.statusOf()).toBe('PROCESSING');
      expect(await h.eventTypes()).toEqual(['video.screening_approved']);
      expect(h.packageQueue.enqueuedJobs).toHaveLength(1);
      expect(h.packageQueue.enqueuedJobs[0]).toMatchObject({
        id: `${HELD_ID}--package--approved--g1`,
        data: { videoId: HELD_ID, screened: true, generation: 1 },
      });
      expect(expectOk(await h.repositories.screenings.latestForVideo(HELD_ID))).toMatchObject({
        decision: 'approved',
        decidedBy: MODERATOR_A.id,
      });
    });

    it('lets the first of two moderators win and tells the second the video changed', async () => {
      expectOk(await h.service.approve(MODERATOR_A, HELD_ID));

      expect(codeOf(await h.service.approve(MODERATOR_B, HELD_ID))).toBe(
        ErrorCodes.VERSION_CONFLICT
      );
      expect(codeOf(await h.service.reject(MODERATOR_B, HELD_ID, 'no'))).toBe(
        ErrorCodes.VERSION_CONFLICT
      );
      expect(h.packageQueue.enqueuedJobs).toHaveLength(1);
      expect(await h.eventTypes()).toEqual(['video.screening_approved']);
    });

    it.each([
      { name: 'the owner', actor: OWNER },
      { name: 'a stranger', actor: STRANGER },
    ])('answers $name with forbidden and changes nothing', async ({ actor }) => {
      expect(codeOf(await h.service.approve(actor, HELD_ID))).toBe(ErrorCodes.FORBIDDEN);
      expect(await h.statusOf()).toBe('HELD');
      expect(h.packageQueue.enqueuedJobs).toEqual([]);
    });

    it('answers an absent video as not found', async () => {
      expect(codeOf(await h.service.approve(MODERATOR_A, ORIGINAL_ID.replace('f2', 'ff')))).toBe(
        ErrorCodes.VIDEO_NOT_FOUND
      );
    });

    it('cannot package a video that never recorded its ladder', async () => {
      const bare = screeningHarness();
      await bare.seedHeld({}, { ladder: null });

      expect(codeOf(await bare.service.approve(MODERATOR_A, HELD_ID))).toBe(
        ErrorCodes.VERSION_CONFLICT
      );
      expect(await bare.statusOf()).toBe('HELD');
    });
  });

  describe('reject', () => {
    it('moves a held video to rejected for the owner to read, and keeps its fingerprints', async () => {
      expectOk(await h.repositories.fingerprints.storeFrames(HELD_ID, [{ idx: 0, hash: 5n }]));

      const decided = expectOk(await h.service.reject(MODERATOR_A, HELD_ID, 'A re-upload'));

      expect(decided).toEqual({ videoId: HELD_ID, status: 'REJECTED' });
      expect(await h.eventTypes()).toEqual(['video.screening_rejected']);
      expect(
        expectOk(await h.repositories.fingerprints.findFramesSharingBand([5n], ORIGINAL_ID))
      ).toHaveLength(1);
      expect(expectOk(await h.service.ownScreening(OWNER, HELD_ID))).toMatchObject({
        status: 'REJECTED',
        decision: 'rejected',
        decisionNote: 'A re-upload',
        canAppeal: true,
      });
    });

    it('refuses a non-moderator', async () => {
      expect(codeOf(await h.service.reject(OWNER, HELD_ID, 'no'))).toBe(ErrorCodes.FORBIDDEN);
      expect(await h.statusOf()).toBe('HELD');
    });
  });

  describe('dismiss', () => {
    it('closes the flags of a public video and leaves it public', async () => {
      const flagged = screeningHarness();
      await flagged.seedHeld(
        { outcome: 'PASS', reasons: [], flags: [partialMatch] },
        { status: 'READY' }
      );

      const decided = expectOk(await flagged.service.dismiss(MODERATOR_A, HELD_ID));

      expect(decided).toEqual({ videoId: HELD_ID, status: 'READY' });
      expect(expectOk(await flagged.service.queue(MODERATOR_A, { state: 'open' })).items).toEqual(
        []
      );
      expect(codeOf(await flagged.service.dismiss(MODERATOR_B, HELD_ID))).toBe(
        ErrorCodes.VERSION_CONFLICT
      );
    });

    it('has nothing to dismiss on a hold nobody decided', async () => {
      expect(codeOf(await h.service.dismiss(MODERATOR_A, HELD_ID))).toBe(
        ErrorCodes.VERSION_CONFLICT
      );
    });
  });

  describe('the owner side', () => {
    it('tells the owner of a held video why, in plain reasons, and never who it matched', async () => {
      const view = expectOk(await h.service.ownScreening(OWNER, HELD_ID));

      expect(view).toEqual({
        videoId: HELD_ID,
        status: 'HELD',
        reasons: ['DUPLICATE', 'NSFW'],
        decision: null,
        decisionNote: null,
        canAppeal: false,
        appeal: null,
      });
      expect(JSON.stringify(view)).not.toContain(ORIGINAL_ID);
      expect(JSON.stringify(view)).not.toContain('0.97');
    });

    it.each([{ name: 'a stranger', actor: STRANGER, code: ErrorCodes.FORBIDDEN }])(
      'refuses $name',
      async ({ actor, code }) => {
        expect(codeOf(await h.service.ownScreening(actor, HELD_ID))).toBe(code);
      }
    );

    it('appeals a screening rejection, takes it back to hold, and has the other moderator decide', async () => {
      expectOk(await h.service.reject(MODERATOR_A, HELD_ID, 'A re-upload'));

      const appealed = expectOk(await h.service.appeal(OWNER, HELD_ID, 'It is my footage'));

      expect(appealed).toMatchObject({
        status: 'HELD',
        decision: null,
        canAppeal: false,
        appeal: { message: 'It is my footage', resolved: false },
      });
      const queue = expectOk(await h.service.queue(MODERATOR_B, { state: 'open' }));
      expect(queue.items[0]).toMatchObject({
        open: true,
        appeal: { message: 'It is my footage', rejectedBy: MODERATOR_A.id },
      });

      expect(codeOf(await h.service.approve(MODERATOR_A, HELD_ID))).toBe(ErrorCodes.FORBIDDEN);
      expect(codeOf(await h.service.reject(MODERATOR_A, HELD_ID, 'again'))).toBe(
        ErrorCodes.FORBIDDEN
      );
      expectOk(await h.service.approve(MODERATOR_B, HELD_ID));

      expect(await h.statusOf()).toBe('PROCESSING');
      expect(await h.eventTypes()).toEqual([
        'video.screening_rejected',
        'video.screening_appealed',
        'video.screening_approved',
      ]);
      expect(expectOk(await h.repositories.screenings.findAppeals(HELD_ID))[0]).toMatchObject({
        resolvedBy: MODERATOR_B.id,
      });
    });

    it('refuses to appeal a takedown by a moderator, and a video that was not rejected', async () => {
      const taken = screeningHarness();
      await taken.seedHeld({}, { status: 'REJECTED', visibility: 'private' });

      expect(codeOf(await taken.service.appeal(OWNER, HELD_ID, 'unfair'))).toBe(
        ErrorCodes.FORBIDDEN
      );
      expect(codeOf(await h.service.appeal(OWNER, HELD_ID, 'unfair'))).toBe(
        ErrorCodes.VALIDATION_FAILED
      );
      expect(await taken.statusOf()).toBe('REJECTED');
      expect(expectOk(await taken.repositories.screenings.findAppeals(HELD_ID))).toEqual([]);
    });

    it('refuses a stranger an appeal, as a video they cannot see', async () => {
      expectOk(await h.service.reject(MODERATOR_A, HELD_ID, 'A re-upload'));

      expect(codeOf(await h.service.appeal(STRANGER, HELD_ID, 'mine'))).toBe(ErrorCodes.FORBIDDEN);
    });
  });
});
