import { act } from '@testing-library/react';
import { abortUpload, completeUpload, startUpload } from '@vp/api-contracts';
import { createQueryClient, myVideosQueryOptions } from '@vp/queries';
import { api, apiServer, mockEndpoint, VIDEO_ID } from '@vp/web-testing';
import { renderMutation, runMutation } from '@vp/web-testing/dom';
import axios from 'axios';
import { delay } from 'msw';
import { HttpResponse } from 'msw/http';
import { AppProviders } from '#app/__tests__/providers';
import { useUploadVideo } from '../use-upload-video';

const UPLOAD_ID = '0190c3a0-5e1d-7000-8000-00000000e001';

const request = {
  file: new File(['abcd'], 'clip.mp4', { type: 'video/mp4' }),
  filename: 'clip.mp4',
  sizeBytes: 4,
  contentType: 'video/mp4',
  title: 'Clip',
};

function answerUpload({ completeNever = false, onComplete = () => {}, multipart = false } = {}) {
  const aborts: string[] = [];
  apiServer.use(
    mockEndpoint(abortUpload, ({ params }) => {
      aborts.push(String(params['uploadId']));
      return new HttpResponse(null, { status: 204 });
    }),
    mockEndpoint(startUpload, () =>
      HttpResponse.json(
        {
          videoId: VIDEO_ID,
          uploadId: UPLOAD_ID,
          expiresAt: '2026-01-01T01:00:00.000Z',
          ...(multipart
            ? {
                strategy: 'multipart',
                partSizeBytes: 1,
                partsExpected: 4,
                parts: [1, 2, 3, 4].map((partNumber) => ({
                  partNumber,
                  url: `http://localhost:9000/raw/part-${partNumber}`,
                  expiresAt: '2026-01-01T01:00:00.000Z',
                })),
              }
            : { strategy: 'single', singleUrl: 'http://localhost:9000/raw/source.mp4' }),
        },
        { status: 201 }
      )
    ),
    mockEndpoint(completeUpload, async () => {
      onComplete();
      if (completeNever) await delay('infinite');
      return HttpResponse.json({ videoId: VIDEO_ID, status: 'UPLOADED' });
    })
  );
  return aborts;
}

function storageStalls() {
  vi.spyOn(axios, 'put').mockImplementation(
    (_url, _file, config) =>
      new Promise((_resolve, reject) =>
        config?.signal?.addEventListener?.('abort', () => reject(new axios.CanceledError()))
      )
  );
}

function keepaliveOfAborts() {
  const sendFetch = vi.spyOn(globalThis, 'fetch');
  return () =>
    sendFetch.mock.calls
      .filter(([, init]) => init?.method === 'DELETE')
      .map(([, init]) => init?.keepalive);
}

function pageHide(persisted: boolean) {
  window.dispatchEvent(Object.assign(new Event('pagehide'), { persisted }));
}

function storageReportsHalfway() {
  vi.spyOn(axios, 'put').mockImplementation(async (_url, _file, config) => {
    config?.onUploadProgress?.({
      loaded: 2,
      total: 4,
      progress: 0.5,
      bytes: 2,
      lengthComputable: true,
    });
    return { headers: {} };
  });
}

describe('apps/client/studio: useUploadVideo', () => {
  it('holds the transfer progress the storage reported', async () => {
    answerUpload();
    storageReportsHalfway();
    const upload = renderMutation(() => useUploadVideo(), createQueryClient(), AppProviders);

    expect(upload.current.progress).toBe(0);
    const completed = await upload.current.mutateAsync(request);

    expect(completed).toEqual({ videoId: VIDEO_ID, status: 'UPLOADED' });
    await vi.waitFor(() => expect(upload.current.progress).toBe(50));
  });

  it("marks the caller's videos stale once the upload settles", async () => {
    answerUpload();
    storageReportsHalfway();
    const mineKey = myVideosQueryOptions(api).queryKey;
    const client = createQueryClient();
    client.setQueryData(mineKey, { pages: [], pageParams: [] });

    await runMutation(client, () => useUploadVideo(), request, AppProviders);

    expect(client.getQueryState(mineKey)?.isInvalidated).toBe(true);
  });

  it('aborts the upload when it is cancelled', async () => {
    const aborts = answerUpload();
    storageStalls();
    const upload = renderMutation(() => useUploadVideo(), createQueryClient(), AppProviders);

    act(() => upload.current.mutate(request));
    await vi.waitFor(() => expect(axios.put).toHaveBeenCalled());
    act(() => upload.current.cancel());

    await vi.waitFor(() => expect(aborts).toEqual([UPLOAD_ID]));
  });

  it('stops every in-flight part and aborts the upload once when cancelled during a multipart upload', async () => {
    const aborts = answerUpload({ multipart: true });
    storageStalls();
    const upload = renderMutation(() => useUploadVideo(), createQueryClient(), AppProviders);

    act(() => upload.current.mutate(request));
    await vi.waitFor(() => expect(axios.put).toHaveBeenCalledTimes(4));
    act(() => upload.current.cancel());

    await vi.waitFor(() => expect(aborts).toEqual([UPLOAD_ID]));
    expect(axios.put).toHaveBeenCalledTimes(4);
  });

  it.each([
    { event: 'the page closing', persisted: false, expected: [true] },
    { event: 'the page entering the back-forward cache', persisted: true, expected: [] },
  ])(
    'on $event, sends the abort as keepalive only if the page is gone',
    async ({ persisted, expected }) => {
      answerUpload();
      storageStalls();
      const keepalives = keepaliveOfAborts();
      const upload = renderMutation(() => useUploadVideo(), createQueryClient(), AppProviders);

      act(() => upload.current.mutate(request));
      await vi.waitFor(() => expect(axios.put).toHaveBeenCalled());
      pageHide(persisted);

      expect(keepalives()).toEqual(expected);
    }
  );

  it('sends no abort when the page closes while the upload is being completed', async () => {
    const onComplete = vi.fn();
    answerUpload({ completeNever: true, onComplete });
    storageReportsHalfway();
    const keepalives = keepaliveOfAborts();
    const upload = renderMutation(() => useUploadVideo(), createQueryClient(), AppProviders);

    act(() => upload.current.mutate(request));
    await vi.waitFor(() => expect(onComplete).toHaveBeenCalled());
    pageHide(false);

    expect(keepalives()).toEqual([]);
  });
});
