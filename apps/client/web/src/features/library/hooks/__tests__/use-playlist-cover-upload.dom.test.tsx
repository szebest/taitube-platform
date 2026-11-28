import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { completePlaylistCover, preparePlaylistCover, updatePlaylist } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { createQueryClient, UserEventStream } from '@vp/queries';
import { apiServer, CHANNEL_ID, mockEndpoint, problemReply } from '@vp/web-testing';
import { streamUserEvents } from '@vp/web-testing/dom';
import { HttpResponse, http } from 'msw/http';
import type { PropsWithChildren } from 'react';
import { playlistDetail, uuid } from '#app/__tests__/library-fixtures';
import { signedIn } from '#app/__tests__/providers';
import { usePlaylistCoverUpload } from '../use-playlist-cover-upload';

const LIST = uuid(4100);
const UPLOAD_ID = '0190c3a0-5e1d-7000-8000-000000000a01';
const OTHER_UPLOAD_ID = '0190c3a0-5e1d-7000-8000-000000000a02';
const UPLOAD_URL = 'http://localhost:9000/raw/cover';
const CHOICE = {
  file: new File(['abcd'], 'cover.png', { type: 'image/png' }),
  size: { width: 1600, height: 900 },
};

const ready = (uploadId: string) =>
  ({
    type: 'channel.image.ready',
    payload: { uploadId, channelId: CHANNEL_ID, kind: 'playlist-cover', version: 1 },
  }) as const;

const failed = (uploadId: string) =>
  ({
    type: 'channel.image.failed',
    payload: { uploadId, channelId: CHANNEL_ID, kind: 'playlist-cover', reason: 'unreadable' },
  }) as const;

function renderCoverUpload(complete: 'queues' | 'refuses' = 'queues') {
  const edits: unknown[] = [];
  apiServer.use(
    mockEndpoint(preparePlaylistCover, () =>
      HttpResponse.json(
        {
          uploadId: UPLOAD_ID,
          uploadUrl: UPLOAD_URL,
          headers: {},
          expiresAt: '2026-01-01T01:00:00.000Z',
        },
        { status: 201 }
      )
    ),
    http.put(UPLOAD_URL, () => new HttpResponse(null, { status: 200 })),
    mockEndpoint(completePlaylistCover, () =>
      complete === 'queues'
        ? HttpResponse.json({ uploadId: UPLOAD_ID, version: 1 }, { status: 202 })
        : problemReply(ErrorCodes.IMAGE_TOO_SMALL)
    ),
    mockEndpoint(updatePlaylist, async ({ request }) => {
      edits.push(await request.json());
      return HttpResponse.json(playlistDetail(LIST, []));
    })
  );
  const stream = streamUserEvents();
  const client = createQueryClient();
  const Session = signedIn();
  const { result } = renderHook(() => usePlaylistCoverUpload(LIST), {
    wrapper: ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>
        <Session>
          <UserEventStream>{children}</UserEventStream>
        </Session>
      </QueryClientProvider>
    ),
  });
  return { result, stream, edits };
}

async function started() {
  const rendered = renderCoverUpload();
  act(() => rendered.result.current.start(CHOICE));
  await waitFor(() => expect(rendered.result.current.status).toBe('working'));
  return rendered;
}

describe('apps/client/web: usePlaylistCoverUpload', () => {
  it('is idle until a cover is started', () => {
    expect(renderCoverUpload().result.current.status).toBe('idle');
  });

  it('makes the upload the cover once its job is announced', async () => {
    const { result, stream, edits } = await started();

    act(() => stream.send(ready(UPLOAD_ID)));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(edits).toEqual([{ coverUploadId: UPLOAD_ID }]);
  });

  it.each([
    { scenario: 'the job failed', send: failed(UPLOAD_ID), status: 'failed' },
    { scenario: "another upload's job finished", send: ready(OTHER_UPLOAD_ID), status: 'working' },
    { scenario: "another upload's job failed", send: failed(OTHER_UPLOAD_ID), status: 'working' },
  ] as const)('answers $status when $scenario', async ({ send, status }) => {
    const { result, stream, edits } = await started();

    act(() => stream.send(send));

    await waitFor(() => expect(result.current.status).toBe(status));
    expect(edits).toEqual([]);
  });

  it('fails when the API refuses to queue the job', async () => {
    const { result } = renderCoverUpload('refuses');

    act(() => result.current.start(CHOICE));

    await waitFor(() => expect(result.current.status).toBe('failed'));
  });
});
