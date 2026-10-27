import { captionsFailed, captionsReady } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import {
  ABSENT_ID,
  CUES,
  captionContractContext,
  GENERATED_ID,
  generated,
  ready,
  trackOf,
  UPLOADED_ID,
  upload,
  userEventsOf,
  videoEventTypes,
} from './caption-contract-context';
import { describeCaptionReadsContract } from './caption-reads.contract';
import { OTHER_OWNER_ID, VIDEO_IDS } from './fixtures';
import type { MakeRepositoriesSubject } from './subjects';

export function describeCaptionRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('CaptionRepository contract', () => {
    const ctx = captionContractContext(makeSubject);

    it('creates the generated track once and hands the same one back on a repeat', async () => {
      const first = await generated(ctx);
      const again = expectOk(
        await ctx.captions.createGenerated({
          id: ABSENT_ID,
          videoId: VIDEO_IDS.a,
          language: null,
          modelVersion: 'whisper-2',
          status: 'pending',
          reason: null,
        })
      );

      expect(first).toMatchObject({
        id: GENERATED_ID,
        kind: 'auto',
        status: 'pending',
        version: 1,
      });
      expect(again).toEqual(first);
      expect(expectOk(await ctx.captions.list(VIDEO_IDS.a))).toHaveLength(1);
      expect(expectOk(await ctx.captions.findGenerated(VIDEO_IDS.a))).toEqual(first);
      expect(expectOk(await ctx.captions.findById(GENERATED_ID))).toEqual(first);
      expect(expectOk(await ctx.captions.findById(ABSENT_ID))).toBeNull();
    });

    it('completes a pending track with its cues and tells the owner', async () => {
      const track = await ready(ctx);

      expect(track).toMatchObject({
        status: 'ready',
        language: 'en',
        detectedLanguage: 'en',
        version: 2,
      });
      expect(expectOk(await ctx.captions.cues(track.id))).toEqual(CUES);
      expect(expectOk(await ctx.captions.findByLanguage(VIDEO_IDS.a, 'en'))).toEqual(track);
      expect(await userEventsOf(ctx)).toEqual([
        captionsReady(VIDEO_IDS.a, { id: track.id, language: 'en', kind: 'auto' }),
      ]);
      expect(await videoEventTypes(ctx)).toEqual(['captions.ready']);
      expect(await userEventsOf(ctx, OTHER_OWNER_ID)).toEqual([]);
    });

    it('writes nothing when the version moved on or the track is gone', async () => {
      const track = await ready(ctx);

      const outcomes = await Promise.all(
        [
          { id: track.id, expectedVersion: 1 },
          { id: ABSENT_ID, expectedVersion: 1 },
        ].map(async (target) =>
          expectOk(
            await ctx.captions.complete({
              ...target,
              language: 'de',
              detectedLanguage: 'de',
              cues: [],
            })
          )
        )
      );

      expect(outcomes).toEqual([{ type: 'stale' }, { type: 'stale' }]);
      expect(expectOk(await ctx.captions.findById(track.id))).toEqual(track);
      expect(expectOk(await ctx.captions.cues(track.id))).toEqual(CUES);
      expect(await userEventsOf(ctx)).toHaveLength(1);
    });

    it('refuses a detected language another track already holds, writing nothing', async () => {
      await upload(ctx, 'en');
      const pending = await generated(ctx);

      const outcome = expectOk(
        await ctx.captions.complete({
          id: pending.id,
          expectedVersion: pending.version,
          language: 'en',
          detectedLanguage: 'en',
          cues: CUES,
        })
      );

      expect(outcome).toEqual({ type: 'language-taken' });
      expect(expectOk(await ctx.captions.findById(pending.id))).toEqual(pending);
      expect(expectOk(await ctx.captions.cues(pending.id))).toEqual([]);
      expect(await videoEventTypes(ctx)).toEqual(['captions.uploaded']);
    });

    it.each([
      { status: 'failed', event: 'captions.failed', announced: true },
      { status: 'disabled', event: 'captions.disabled', announced: false },
    ] as const)(
      'moves a pending track to $status and records $event',
      async ({ status, event, announced }) => {
        const pending = await generated(ctx);

        const outcome = expectOk(
          await ctx.captions.fail({
            id: pending.id,
            expectedVersion: 1,
            status,
            reason: 'NO_AUDIO',
          })
        );

        expect(outcome).toMatchObject({
          type: 'committed',
          track: { status, reason: 'NO_AUDIO', version: 2 },
        });
        expect(await videoEventTypes(ctx)).toEqual([event]);
        expect(await userEventsOf(ctx)).toEqual(
          announced ? [captionsFailed(VIDEO_IDS.a, pending.id, 'NO_AUDIO')] : []
        );
      }
    );

    it('answers stale for a fail based on an older version', async () => {
      const pending = await generated(ctx);

      expect(
        expectOk(
          await ctx.captions.fail({
            id: pending.id,
            expectedVersion: 5,
            status: 'failed',
            reason: 'X',
          })
        )
      ).toEqual({ type: 'stale' });
      expect(expectOk(await ctx.captions.findById(pending.id))).toEqual(pending);
    });

    it('sends a track back to pending as auto for a new run, keeping its cues', async () => {
      const edited = await ready(ctx);
      expectOk(
        await ctx.captions.editCues({
          id: edited.id,
          expectedVersion: edited.version,
          cues: [{ index: 0, text: 'Hi' }],
        })
      );

      const outcome = expectOk(
        await ctx.captions.regenerate({
          id: edited.id,
          expectedVersion: 3,
          modelVersion: 'whisper-2',
          language: null,
        })
      );

      expect(outcome).toMatchObject({
        type: 'committed',
        track: {
          kind: 'auto',
          status: 'pending',
          language: null,
          modelVersion: 'whisper-2',
          reason: null,
          version: 4,
        },
      });
      expect(expectOk(await ctx.captions.cues(edited.id))).toHaveLength(CUES.length);
      expect(await videoEventTypes(ctx)).toEqual([
        'captions.ready',
        'captions.edited',
        'captions.requested',
      ]);
      expect(
        expectOk(
          await ctx.captions.regenerate({
            id: edited.id,
            expectedVersion: 3,
            modelVersion: 'x',
            language: null,
          })
        )
      ).toEqual({
        type: 'stale',
      });
    });

    it('creates an uploaded track, then replaces the track of that language whatever its kind', async () => {
      const created = await upload(ctx, 'pl');
      const generatedEn = await ready(ctx);
      const replaced = await upload(ctx, 'en', ABSENT_ID);

      expect(created).toMatchObject({
        type: 'committed',
        track: { id: UPLOADED_ID, kind: 'uploaded', status: 'ready', language: 'pl', version: 1 },
      });
      expect(replaced).toMatchObject({
        type: 'committed',
        track: {
          id: generatedEn.id,
          kind: 'uploaded',
          status: 'ready',
          version: generatedEn.version + 1,
        },
      });
      expect(expectOk(await ctx.captions.list(VIDEO_IDS.a))).toHaveLength(2);
      expect(expectOk(await ctx.captions.findGenerated(VIDEO_IDS.a))).toBeNull();
      expect(expectOk(await ctx.captions.cues(UPLOADED_ID))).toEqual(CUES);
      expect(await videoEventTypes(ctx)).toEqual([
        'captions.uploaded',
        'captions.ready',
        'captions.uploaded',
      ]);
    });

    it('replaces the cues of an uploaded track on a second upload', async () => {
      await upload(ctx, 'pl');
      expectOk(
        await ctx.captions.upload({
          id: ABSENT_ID,
          videoId: VIDEO_IDS.a,
          language: 'pl',
          cues: [{ index: 0, startMs: 0, endMs: 10, text: 'Nowy' }],
        })
      );

      expect(expectOk(await ctx.captions.cues(UPLOADED_ID))).toEqual([
        { index: 0, startMs: 0, endMs: 10, text: 'Nowy' },
      ]);
      expect(expectOk(await ctx.captions.findById(UPLOADED_ID))).toMatchObject({ version: 2 });
    });

    it.each([
      { scenario: 'an auto track becomes edited', upload: false, kind: 'edited' },
      { scenario: 'an uploaded track stays uploaded', upload: true, kind: 'uploaded' },
    ])('edits cue text and leaves timing alone: $scenario', async ({ upload: uploaded, kind }) => {
      const track = uploaded ? trackOf(await upload(ctx, 'en')) : await ready(ctx);

      const outcome = expectOk(
        await ctx.captions.editCues({
          id: track.id,
          expectedVersion: track.version,
          cues: [{ index: 1, text: 'Today we bake rye' }],
        })
      );

      expect(outcome).toMatchObject({
        type: 'committed',
        track: { kind, version: track.version + 1 },
      });
      expect(expectOk(await ctx.captions.cues(track.id))).toEqual([
        CUES[0],
        { ...CUES[1], text: 'Today we bake rye' },
        CUES[2],
      ]);
    });

    it('rejects an edit based on an older version', async () => {
      const track = await ready(ctx);

      expect(
        expectOk(
          await ctx.captions.editCues({
            id: track.id,
            expectedVersion: 1,
            cues: [{ index: 0, text: 'x' }],
          })
        )
      ).toEqual({ type: 'stale' });
      expect(expectOk(await ctx.captions.cues(track.id))).toEqual(CUES);
    });
  });

  describeCaptionReadsContract(makeSubject);
}
