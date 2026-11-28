import { randomUUID } from 'node:crypto';
import { expectOk } from '@kit/testing/result';
import type { ViewBatch } from '@vp/domain';
import { ACCESS_DAY, ACCESS_NEXT_DAY } from './access-fixtures';
import type { MakeViewBufferSubject, ViewBufferSubject } from './view-buffer.contract';

export function describeViewBufferPlaylistContract(makeSubject: MakeViewBufferSubject): void {
  describe('ViewBuffer playlist contract', () => {
    let subject: ViewBufferSubject;
    let playlistId: string;
    let videoId: string;

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
      playlistId = randomUUID();
      videoId = randomUUID();
      await drain();
      await drain();
    });

    it('adds each event to its playlist and day, a play to its video too', async () => {
      expectOk(
        await subject.buffer.recordPlaylistEvents([
          { measure: 'follows', playlistId, viewDate: ACCESS_DAY },
          { measure: 'forks', playlistId, viewDate: ACCESS_NEXT_DAY },
          { measure: 'plays', playlistId, videoId, viewDate: ACCESS_DAY },
          { measure: 'plays', playlistId, videoId, viewDate: ACCESS_DAY },
        ])
      );

      const batch = await drain();

      expect(batch?.playlists).toEqual(
        expect.arrayContaining([
          {
            playlistId,
            videoId: null,
            viewDate: ACCESS_DAY,
            opens: 0,
            plays: 0,
            follows: 1,
            forks: 0,
          },
          {
            playlistId,
            videoId: null,
            viewDate: ACCESS_NEXT_DAY,
            opens: 0,
            plays: 0,
            follows: 0,
            forks: 1,
          },
          { playlistId, videoId, viewDate: ACCESS_DAY, opens: 0, plays: 2, follows: 0, forks: 0 },
        ])
      );
      expect(batch?.playlists).toHaveLength(3);
      expect(batch).toMatchObject({ counts: [], devices: [], shareLinks: [], experiments: [] });
    });

    it('counts an open once per viewer, playlist and day, beside the other measures', async () => {
      const open = (viewerKey: string, viewDate = ACCESS_DAY) =>
        subject.buffer.recordPlaylistOpen({ playlistId, viewerKey, viewDate });

      expect(expectOk(await open('viewer-1'))).toBe('counted');
      expect(expectOk(await open('viewer-1'))).toBe('duplicate');
      expectOk(await open('viewer-2'));
      expectOk(await open('viewer-1', ACCESS_NEXT_DAY));
      expectOk(
        await subject.buffer.recordPlaylistEvents([
          { measure: 'follows', playlistId, viewDate: ACCESS_DAY },
        ])
      );

      expect((await drain())?.playlists).toEqual(
        expect.arrayContaining([
          {
            playlistId,
            videoId: null,
            viewDate: ACCESS_DAY,
            opens: 2,
            plays: 0,
            follows: 1,
            forks: 0,
          },
          {
            playlistId,
            videoId: null,
            viewDate: ACCESS_NEXT_DAY,
            opens: 1,
            plays: 0,
            follows: 0,
            forks: 0,
          },
        ])
      );
    });

    it('takes an empty batch of events as nothing to count', async () => {
      expectOk(await subject.buffer.recordPlaylistEvents([]));

      expect(await drain()).toBeNull();
    });
  });
}
