import { randomUUID } from 'node:crypto';
import { err } from '@kit/result';
import { expectOk } from '@kit/testing/result';
import { InMemoryViewBuffer } from '@vp/adapters/in-memory';
import { cacheUnavailable } from '@vp/errors';
import { PlaylistStatsRecorder } from '../playlist-stats-recorder';

const LIST = '00000000-0000-7000-8000-0000000000f1';
const LINK = {
  id: '00000000-0000-7000-8000-0000000000f2',
  targetType: 'playlist',
  targetId: LIST,
  token: 'a'.repeat(22),
  label: null,
  expiresAt: null,
  createdBy: null,
  revokedAt: null,
  createdAt: new Date(),
} as const;
const NOW = Date.parse('2026-11-20T12:00:00.000Z');

function setUp() {
  const viewBuffer = new InMemoryViewBuffer();
  const recorder = new PlaylistStatsRecorder({ viewBuffer, now: () => NOW });
  const drain = async () => expectOk(await viewBuffer.snapshot(randomUUID()));
  return { viewBuffer, recorder, drain };
}

describe('PlaylistStatsRecorder', () => {
  it('counts an open and a link open once a viewer and day, on the day it happened', async () => {
    const { recorder, drain } = setUp();

    await recorder.opened(LIST, 'viewer-1');
    await recorder.opened(LIST, 'viewer-1');
    await recorder.linkOpened(LINK, 'viewer-1');
    await recorder.record([{ measure: 'forks', playlistId: LIST }]);

    expect(await drain()).toMatchObject({
      playlists: [expect.objectContaining({ viewDate: '2026-11-20', opens: 1, forks: 1 })],
      shareLinks: [expect.objectContaining({ linkId: LINK.id, opens: 1 })],
    });
  });

  it('counts nothing for a read with neither an account nor a session', async () => {
    const { recorder, drain } = setUp();

    await recorder.opened(LIST, null);
    await recorder.linkOpened(LINK, null);

    expect(await drain()).toBeNull();
  });

  it('takes a buffer that cannot count as a gap, never a failure', async () => {
    const { viewBuffer, recorder } = setUp();
    vi.spyOn(viewBuffer, 'recordPlaylistOpen').mockResolvedValueOnce(
      err(cacheUnavailable('recordPlaylistOpen'))
    );
    vi.spyOn(viewBuffer, 'recordPlaylistEvents').mockResolvedValueOnce(
      err(cacheUnavailable('recordPlaylistEvents'))
    );

    await expect(recorder.opened(LIST, 'viewer-1')).resolves.toBeUndefined();
    await expect(
      recorder.record([{ measure: 'follows', playlistId: LIST }])
    ).resolves.toBeUndefined();
  });
});
