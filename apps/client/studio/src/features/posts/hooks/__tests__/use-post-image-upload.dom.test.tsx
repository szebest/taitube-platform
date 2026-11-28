import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { UserEventStream } from '@vp/queries';
import { CHANNEL_ID } from '@vp/web-testing';
import { apiServer } from '@vp/web-testing';
import { streamUserEvents } from '@vp/web-testing/dom';
import axios from 'axios';
import { type PropsWithChildren, useState } from 'react';
import { signedIn } from '#app/__tests__/providers';
import { EMPTY_DRAFT, type PostDraft } from '#app/components/posts/post-composer';
import { servePosts, UPLOAD_ID } from '#app/features/posts/__tests__/posts-api.fixture';
import { usePostImageUpload } from '../use-post-image-upload';

const png = (name = 'a.png', type = 'image/png') => new File(['abcd'], name, { type });

const ready = () =>
  ({
    type: 'channel.image.ready',
    payload: { uploadId: UPLOAD_ID, channelId: CHANNEL_ID, kind: 'post-image', version: 1 },
  }) as const;

const failed = () =>
  ({
    type: 'channel.image.failed',
    payload: {
      uploadId: UPLOAD_ID,
      channelId: CHANNEL_ID,
      kind: 'post-image',
      reason: 'unreadable',
    },
  }) as const;

function renderUpload({
  size = { width: 800, height: 600 } as { width: number; height: number } | null,
} = {}) {
  const stream = streamUserEvents();
  const { requests, handlers } = servePosts();
  apiServer.use(...handlers);
  vi.spyOn(axios, 'put').mockResolvedValue({});
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(() =>
      size ? Promise.resolve({ ...size, close: vi.fn() }) : Promise.reject(new Error('no'))
    )
  );
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: () => 'blob:p', revokeObjectURL: vi.fn() })
  );
  const Session = signedIn();
  const { result } = renderHook(
    () => {
      const [draft, setDraft] = useState<PostDraft>(EMPTY_DRAFT);
      return { draft, ...usePostImageUpload(setDraft) };
    },
    {
      wrapper: ({ children }: PropsWithChildren) => (
        <QueryClientProvider client={new QueryClient()}>
          <Session>
            <UserEventStream>{children}</UserEventStream>
          </Session>
        </QueryClientProvider>
      ),
    }
  );
  return { result, stream, requests };
}

describe('apps/client/studio: usePostImageUpload', () => {
  it('shows a picture at once, uploads it as a post image, and counts it ready when the channel says so', async () => {
    const { result, stream, requests } = renderUpload();

    act(() => result.current.add([png()]));

    await waitFor(() => expect(result.current.draft.images[0]?.uploadId).toBe(UPLOAD_ID));
    expect(result.current.draft.images[0]).toMatchObject({
      status: 'uploading',
      previewUrl: 'blob:p',
    });
    expect(requests.uploads).toEqual([
      { kind: 'post-image', contentType: 'image/png', sizeBytes: 4 },
    ]);
    expect(axios.put).toHaveBeenCalled();

    act(() => stream.send(ready()));

    await waitFor(() => expect(result.current.draft.images[0]?.status).toBe('ready'));
  });

  it('marks a picture failed when the channel gives up on it', async () => {
    const { result, stream } = renderUpload();
    act(() => result.current.add([png()]));
    await waitFor(() => expect(result.current.draft.images[0]?.uploadId).toBe(UPLOAD_ID));

    act(() => stream.send(failed()));

    await waitFor(() => expect(result.current.draft.images[0]?.status).toBe('failed'));
  });

  it.each([
    {
      scenario: 'a type that is no image',
      file: png('a.gif', 'image/gif'),
      size: { width: 800, height: 600 },
      says: /content type|unsupported/i,
    },
    { scenario: 'a file that does not decode', file: png(), size: null, says: /could not be read/ },
    {
      scenario: 'a picture too small',
      file: png(),
      size: { width: 100, height: 100 },
      says: /too small/,
    },
  ])('turns away $scenario, adding nothing', async ({ file, size, says }) => {
    const { result } = renderUpload({ size });

    act(() => result.current.add([file]));

    await waitFor(() => expect(result.current.refusal).toMatch(says));
    expect(result.current.draft.images).toEqual([]);
  });
});
