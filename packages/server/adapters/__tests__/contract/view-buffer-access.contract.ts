import { randomUUID } from 'node:crypto';
import { expectOk } from '@kit/testing/result';
import type { ExperimentEvent, PlaybackWatch, ShareLinkOpen } from '@vp/core/ports';
import type { ViewBatch } from '@vp/domain';
import { ACCESS_DAY, ACCESS_NEXT_DAY } from './access-fixtures';
import type { MakeViewBufferSubject, ViewBufferSubject } from './view-buffer.contract';

const HOUR = '2026-03-10T13:00:00.000Z';

export function describeViewBufferAccessContract(makeSubject: MakeViewBufferSubject): void {
  describe('ViewBuffer share link and test contract', () => {
    let subject: ViewBufferSubject;
    let videoId: string;
    let linkId: string;
    let experimentId: string;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    const drain = async (): Promise<ViewBatch | null> => {
      const batch = expectOk(await subject.buffer.snapshot(randomUUID()));
      if (batch) expectOk(await subject.buffer.release(batch.batchId));
      return batch;
    };

    beforeEach(async () => {
      videoId = randomUUID();
      linkId = randomUUID();
      experimentId = randomUUID();
      await drain();
      await drain();
    });

    const playback = (overrides: Partial<PlaybackWatch> = {}): PlaybackWatch => ({
      videoId,
      sessionId: randomUUID(),
      viewDate: ACCESS_DAY,
      viewHour: HOUR,
      device: 'desktop',
      watchedSeconds: 6,
      requiredSeconds: 5,
      shareLinkId: null,
      experiment: null,
      ...overrides,
    });

    const open = (overrides: Partial<ShareLinkOpen> = {}): ShareLinkOpen => ({
      videoId,
      linkId,
      viewerKey: randomUUID(),
      viewDate: ACCESS_DAY,
      ...overrides,
    });

    const shown = (measure: ExperimentEvent['measure'], variantId: 'a' | 'b' = 'b') => ({
      videoId,
      experimentId,
      variantId,
      viewDate: ACCESS_DAY,
      measure,
    });

    const play = async (event: PlaybackWatch) =>
      expectOk(await subject.buffer.recordPlayback(event));

    it('credits the watch seconds and the counted view of a session to the link it came through', async () => {
      const event = playback({ shareLinkId: linkId });

      expect(await play(event)).toBe('counted');
      expect(await play({ ...event, watchedSeconds: 4 })).toBe('pending');

      expect(await drain()).toMatchObject({
        counts: [{ videoId, viewDate: ACCESS_DAY, views: 1, watchSeconds: 10 }],
        shareLinks: [{ linkId, viewDate: ACCESS_DAY, opens: 0, views: 1, watchSeconds: 10 }],
        experiments: [],
      });
    });

    it('credits a viewer the day already counted with the watch seconds but not a second view', async () => {
      const event = playback({ shareLinkId: linkId });
      expectOk(
        await subject.buffer.record({
          videoId,
          viewerId: event.sessionId,
          viewDate: ACCESS_DAY,
          viewHour: HOUR,
        })
      );

      expect(await play(event)).toBe('duplicate');

      expect((await drain())?.shareLinks).toEqual([
        { linkId, viewDate: ACCESS_DAY, opens: 0, views: 0, watchSeconds: 6 },
      ]);
    });

    it('leaves the link and the test alone for a session that came through neither', async () => {
      await play(playback());

      expect(await drain()).toMatchObject({ shareLinks: [], experiments: [] });
    });

    it('counts an open once per viewer, link and day, and again for another day or viewer', async () => {
      const viewerKey = randomUUID();

      expect(expectOk(await subject.buffer.recordShareLinkOpen(open({ viewerKey })))).toBe(
        'counted'
      );
      expect(expectOk(await subject.buffer.recordShareLinkOpen(open({ viewerKey })))).toBe(
        'duplicate'
      );
      expectOk(await subject.buffer.recordShareLinkOpen(open()));
      expectOk(
        await subject.buffer.recordShareLinkOpen(open({ viewerKey, viewDate: ACCESS_NEXT_DAY }))
      );
      expectOk(await subject.buffer.recordShareLinkOpen(open({ linkId: randomUUID(), viewerKey })));

      expect((await drain())?.shareLinks).toEqual(
        expect.arrayContaining([
          { linkId, viewDate: ACCESS_DAY, opens: 2, views: 0, watchSeconds: 0 },
          { linkId, viewDate: ACCESS_NEXT_DAY, opens: 1, views: 0, watchSeconds: 0 },
        ])
      );
    });

    it('adds the impressions, starts and watch seconds of a variant, apart from the others', async () => {
      expectOk(
        await subject.buffer.recordExperimentEvents([
          shown('impressions'),
          shown('impressions'),
          shown('impressions', 'a'),
          shown('starts'),
        ])
      );
      await play(playback({ experiment: { experimentId, variantId: 'b' } }));

      expect((await drain())?.experiments).toEqual(
        expect.arrayContaining([
          {
            experimentId,
            variantId: 'b',
            viewDate: ACCESS_DAY,
            impressions: 2,
            starts: 1,
            watchSeconds: 6,
          },
          {
            experimentId,
            variantId: 'a',
            viewDate: ACCESS_DAY,
            impressions: 1,
            starts: 0,
            watchSeconds: 0,
          },
        ])
      );
    });

    it('takes no events as nothing', async () => {
      expectOk(await subject.buffer.recordExperimentEvents([]));

      expect(await drain()).toBeNull();
    });

    it('snapshots a buffer holding only opens and impressions, and hands the same batch back until release', async () => {
      const first = randomUUID();
      expectOk(await subject.buffer.recordShareLinkOpen(open()));
      expectOk(await subject.buffer.recordExperimentEvents([shown('impressions')]));

      const batch = expectOk(await subject.buffer.snapshot(first));
      expectOk(await subject.buffer.recordShareLinkOpen(open()));
      const again = expectOk(await subject.buffer.snapshot(randomUUID()));
      expectOk(await subject.buffer.release(first));
      const next = await drain();

      expect(batch).toMatchObject({
        batchId: first,
        counts: [],
        shareLinks: [{ linkId, opens: 1 }],
        experiments: [{ experimentId, impressions: 1 }],
      });
      expect(again).toEqual(batch);
      expect(next?.shareLinks).toEqual([
        { linkId, viewDate: ACCESS_DAY, opens: 1, views: 0, watchSeconds: 0 },
      ]);
    });
  });
}
