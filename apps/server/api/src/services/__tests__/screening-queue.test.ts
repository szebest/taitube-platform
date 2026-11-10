import { ErrorCodes } from '@vp/errors';
import type { Result } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import {
  FRAME_KEY,
  HELD_ID,
  MODERATOR_A,
  ORIGINAL_ID,
  OWNER,
  SCREENING_ID,
  STRANGER,
  screeningHarness,
} from './screening-harness';

const codeOf = <E extends { code: string }>(result: Result<unknown, E>) => expectErr(result).code;

describe('apps/server/api/services: screening queue', () => {
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
});
