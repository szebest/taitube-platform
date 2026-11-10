import { expectOk } from '@vp/testing/result';
import { dropUnavailable } from '../watch-party-availability';
import { ROOM_ID } from './watch-party-moderation-fixture';
import { socketRoom } from './watch-party-socket-fixture';
import { deleteVideo, VIDEO_A, VIDEO_B } from './watch-party-test-deps';

describe('dropUnavailable', () => {
  it('leaves a queue of playable videos as it is', async () => {
    const party = await socketRoom();

    const checked = expectOk(await dropUnavailable(party.deps, await party.room()));

    expect(checked.removed).toBe(0);
    expect(checked.queue.items).toHaveLength(2);
    expect(party.systemLines()).toEqual([]);
  });

  it.each([
    { scenario: 'the current one', gone: VIDEO_A, kept: VIDEO_B },
    { scenario: 'a queued one', gone: VIDEO_B, kept: VIDEO_A },
  ])(
    'takes $scenario off the queue with a system line when it is deleted',
    async ({ gone, kept }) => {
      const party = await socketRoom();
      await deleteVideo(party, gone);

      const checked = expectOk(await dropUnavailable(party.deps, await party.room()));

      expect(checked.removed).toBe(1);
      expect(checked.queue.items.map(({ videoId }) => videoId)).toEqual([kept]);
      expect(expectOk(await party.repositories.watchPartyQueue.list(ROOM_ID)).items).toHaveLength(
        1
      );
      expect(party.systemLines()).toEqual([
        expect.objectContaining({ event: 'video_unavailable', detail: gone }),
      ]);
    }
  );
});
