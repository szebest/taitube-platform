import { screen, waitFor, within } from '@testing-library/react';
import { completePlaylistCover, preparePlaylistCover, updatePlaylist } from '@vp/api-contracts';
import { CHANNEL_ID, mockEndpoint } from '@vp/web-testing';
import { streamUserEvents } from '@vp/web-testing/dom';
import { HttpResponse, http } from 'msw/http';
import { act } from 'react';
import { playlistDetail } from '#app/__tests__/library-fixtures';
import {
  chooseFromMore,
  LAZY,
  LIST,
  renderPlaylist,
  VIDEOS,
} from '#app/features/library/__tests__/render-playlist';
import { LazySettingsDialog } from '#app/features/library/components/settings-dialog/settings-dialog.lazy';

const UPLOAD_ID = '0190c3a0-5e1d-7000-8000-000000000a01';
const UPLOAD_URL = 'http://localhost:9000/raw/cover';
const COVER = new File(['abcd'], 'cover.png', { type: 'image/png' });

function decodesAs(width: number, height: number) {
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width, height, close: vi.fn() }));
}

/** The owner's Settings dialog with the cover upload served; `sent` collects each call it makes. */
async function openCover() {
  const sent: string[] = [];
  const stream = streamUserEvents();
  const rendered = await renderPlaylist({}, [
    mockEndpoint(preparePlaylistCover, () => {
      sent.push('prepare');
      return HttpResponse.json(
        {
          uploadId: UPLOAD_ID,
          uploadUrl: UPLOAD_URL,
          headers: {},
          expiresAt: '2026-01-01T01:00:00.000Z',
        },
        { status: 201 }
      );
    }),
    http.put(UPLOAD_URL, () => new HttpResponse(null, { status: 200 })),
    mockEndpoint(completePlaylistCover, () => {
      sent.push('complete');
      return HttpResponse.json({ uploadId: UPLOAD_ID, version: 1 }, { status: 202 });
    }),
    mockEndpoint(updatePlaylist, async ({ request }) => {
      sent.push(`update ${JSON.stringify(await request.json())}`);
      return HttpResponse.json(
        playlistDetail(LIST, VIDEOS, { cover: { mode: 'custom', videoId: null, mosaicUrls: [] } })
      );
    }),
  ]);
  await chooseFromMore(rendered.user, 'Settings');
  const dialog = await screen.findByRole('dialog', { name: 'Playlist settings' }, LAZY);
  const input = dialog.querySelector('input[type="file"]');
  if (!input) throw new Error('No file input in the settings');
  const choose = (file: File) => rendered.user.upload(input as HTMLInputElement, file);
  return { dialog: within(dialog), choose, sent, stream };
}

beforeAll(() => LazySettingsDialog.preload());

describe('apps/client/web: the custom cover upload', () => {
  it('uploads a cover and makes it the cover once its job is done', async () => {
    decodesAs(1600, 900);
    const { dialog, choose, sent, stream } = await openCover();

    await choose(COVER);
    expect(await dialog.findByRole('status')).toHaveTextContent('Preparing your cover');
    act(() =>
      stream.send({
        type: 'channel.image.ready',
        payload: { uploadId: UPLOAD_ID, channelId: CHANNEL_ID, kind: 'playlist-cover', version: 1 },
      })
    );

    await waitFor(() =>
      expect(sent).toEqual(['prepare', 'complete', `update {"coverUploadId":"${UPLOAD_ID}"}`])
    );
    await waitFor(() => expect(dialog.queryByRole('status')).not.toBeInTheDocument());
  });

  it.each([
    { scenario: 'too small', decode: () => decodesAs(320, 180), says: 'at least 640 x 360 px' },
    {
      scenario: 'not an image',
      decode: () => vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('x'))),
      says: 'could not be read as an image',
    },
  ])('refuses a file that is $scenario and sends nothing', async ({ decode, says }) => {
    decode();
    const { dialog, choose, sent } = await openCover();

    await choose(COVER);

    expect(await dialog.findByRole('alert')).toHaveTextContent(says);
    expect(sent).toEqual([]);
  });
});
