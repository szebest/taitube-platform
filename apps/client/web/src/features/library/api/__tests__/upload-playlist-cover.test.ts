import { completePlaylistCover, preparePlaylistCover } from '@vp/api-contracts';
import { api, apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse, http } from 'msw/http';
import { uuid } from '#app/__tests__/library-fixtures';
import { uploadPlaylistCover } from '../upload-playlist-cover';

const LIST = uuid(4100);
const UPLOAD_ID = '0190c3a0-5e1d-7000-8000-000000000a01';
const UPLOAD_URL = 'http://localhost:9000/raw/channel-images/c1/playlist-cover/u1';
const FILE = new File(['abcd'], 'cover.png', { type: 'image/png' });

function serving(putStatus = 200) {
  const sent: unknown[] = [];
  apiServer.use(
    mockEndpoint(preparePlaylistCover, async ({ request, params }) => {
      sent.push({ prepare: params['id'], body: await request.json() });
      return HttpResponse.json(
        {
          uploadId: UPLOAD_ID,
          uploadUrl: UPLOAD_URL,
          headers: { 'content-type': 'image/png' },
          expiresAt: '2026-01-01T01:00:00.000Z',
        },
        { status: 201 }
      );
    }),
    http.put(UPLOAD_URL, async ({ request }) => {
      sent.push({ put: await request.text(), type: request.headers.get('content-type') });
      return new HttpResponse(null, { status: putStatus });
    }),
    mockEndpoint(completePlaylistCover, async ({ request }) => {
      sent.push({ complete: await request.json() });
      return HttpResponse.json({ uploadId: UPLOAD_ID, version: 3 }, { status: 202 });
    })
  );
  return sent;
}

describe('apps/client/web: uploadPlaylistCover', () => {
  it('presigns the cover, sends the file to it, then queues the job with its centred crop', async () => {
    const sent = serving();
    const onPrepared = vi.fn();

    const queued = await uploadPlaylistCover(
      api,
      LIST,
      { file: FILE, size: { width: 1280, height: 2000 } },
      onPrepared
    );

    expect(queued).toEqual({ uploadId: UPLOAD_ID, version: 3 });
    expect(onPrepared).toHaveBeenCalledWith(UPLOAD_ID);
    expect(sent).toEqual([
      { prepare: LIST, body: { contentType: 'image/png', sizeBytes: 4 } },
      { put: 'abcd', type: 'image/png' },
      {
        complete: {
          uploadId: UPLOAD_ID,
          width: 1280,
          height: 2000,
          crop: { x: 0, y: 640, width: 1280, height: 720 },
        },
      },
    ]);
  });

  it('stops before queueing when the storage refuses the file', async () => {
    const sent = serving(403);

    await expect(
      uploadPlaylistCover(api, LIST, { file: FILE, size: { width: 1600, height: 900 } }, vi.fn())
    ).rejects.toThrow('403');
    expect(sent).toHaveLength(2);
  });
});
