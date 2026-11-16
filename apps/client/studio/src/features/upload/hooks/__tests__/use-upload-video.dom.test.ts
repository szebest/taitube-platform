import { act } from '@testing-library/react';
import { abortUpload, completeUpload, startUpload } from '@vp/api-contracts';
import { createQueryClient, myVideosQueryOptions } from '@vp/queries';
import { api, apiServer, mockEndpoint, VIDEO_ID } from '@vp/web-testing';
import { heldReply, renderMutation, runMutation } from '@vp/web-testing/dom';
import axios from 'axios';
import { HttpResponse } from 'msw/http';
import { AppProviders } from '#app/__tests__/providers';
import { uploadKeys } from '#app/features/upload/api/upload-progress';
import { type UploadVariables, useUploadVideo } from '../use-upload-video';

const UPLOAD_ID = '0190c3a0-5e1d-7000-8000-00000000e001';

const ID = 'upload-1';

const variables: UploadVariables = {
  id: ID,
  request: {
    file: new File(['abcd'], 'clip.mp4', { type: 'video/mp4' }),
    filename: 'clip.mp4',
    sizeBytes: 4,
    contentType: 'video/mp4',
    title: 'Clip',
  },
};

const SECOND_ID = 'upload-2';

const SECOND_FILE = new File(['wxyz'], 'second.mp4', { type: 'video/mp4' });

const secondRequest = { ...variables.request, file: SECOND_FILE, filename: 'second.mp4' };

function answerUpload({
  completion = async () => {},
  onComplete = () => {},
  multipart = false,
  partsExpected = 4,
  partSizeBytes = 1,
} = {}) {
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
                partSizeBytes,
                partsExpected,
                parts: Array.from({ length: partsExpected }, (_, index) => index + 1).map(
                  (partNumber) => ({
                    partNumber,
                    url: `http://localhost:9000/raw/part-${partNumber}`,
                    expiresAt: '2026-01-01T01:00:00.000Z',
                  })
                ),
              }
            : { strategy: 'single', singleUrl: 'http://localhost:9000/raw/source.mp4' }),
        },
        { status: 201 }
      )
    ),
    mockEndpoint(completeUpload, async () => {
      onComplete();
      await completion();
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

function signalOfPut(file: File) {
  const call = vi.mocked(axios.put).mock.calls.find(([, body]) => body === file);
  return call?.[2]?.signal as AbortSignal | undefined;
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

function reportBytes(
  config: Parameters<typeof axios.put>[2],
  { loaded, total }: { loaded: number; total: number }
) {
  config?.onUploadProgress?.({
    loaded,
    total,
    progress: loaded / total,
    bytes: loaded,
    lengthComputable: true,
  });
}

function storageReportsHalfway() {
  vi.spyOn(axios, 'put').mockImplementation(async (_url, _file, config) => {
    reportBytes(config, { loaded: 2, total: 4 });
    return { headers: {} };
  });
}

function storageHoldsTwoHalfSentParts() {
  const releases: (() => void)[] = [];
  vi.spyOn(axios, 'put').mockImplementation(
    (_url, _body, config) =>
      new Promise((resolve) => {
        reportBytes(config, { loaded: 1, total: 2 });
        releases.push(() => resolve({ headers: { etag: '"etag"' } }));
      })
  );
  return () => {
    for (const release of releases) release();
  };
}

describe('apps/client/studio: useUploadVideo', () => {
  it('stores the bytes the single PUT reported in the query cache under the upload id', async () => {
    answerUpload();
    storageReportsHalfway();
    const client = createQueryClient();
    const upload = renderMutation(() => useUploadVideo(), client, AppProviders);

    expect(client.getQueryData(uploadKeys.progress(ID))).toBeUndefined();
    const completed = await upload.current.mutateAsync(variables);

    expect(completed).toEqual({ videoId: VIDEO_ID, status: 'UPLOADED' });
    expect(client.getQueryData(uploadKeys.progress(ID))).toEqual({ loaded: 2, total: 4 });
  });

  it('stores the sum of the bytes every multipart part has sent', async () => {
    answerUpload({ multipart: true, partsExpected: 2, partSizeBytes: 2 });
    const releaseParts = storageHoldsTwoHalfSentParts();
    const client = createQueryClient();
    const upload = renderMutation(() => useUploadVideo(), client, AppProviders);

    const uploading = upload.current.mutateAsync(variables);
    await vi.waitFor(() =>
      expect(client.getQueryData(uploadKeys.progress(ID))).toEqual({ loaded: 2, total: 4 })
    );
    releaseParts();
    await uploading;

    expect(client.getQueryData(uploadKeys.progress(ID))).toEqual({ loaded: 4, total: 4 });
  });

  it("marks the caller's videos stale once the upload settles", async () => {
    answerUpload();
    storageReportsHalfway();
    const mineKey = myVideosQueryOptions(api).queryKey;
    const client = createQueryClient();
    client.setQueryData(mineKey, { pages: [], pageParams: [] });

    await runMutation(client, () => useUploadVideo(), variables, AppProviders);

    expect(client.getQueryState(mineKey)?.isInvalidated).toBe(true);
  });

  it('aborts the upload when it is cancelled', async () => {
    const aborts = answerUpload();
    storageStalls();
    const upload = renderMutation(() => useUploadVideo(), createQueryClient(), AppProviders);

    act(() => upload.current.start(ID, variables.request));
    await vi.waitFor(() => expect(axios.put).toHaveBeenCalled());
    act(() => upload.current.cancel(ID));

    await vi.waitFor(() => expect(aborts).toEqual([UPLOAD_ID]));
  });

  it('stops every in-flight part and aborts the upload once when cancelled during a multipart upload', async () => {
    const aborts = answerUpload({ multipart: true });
    storageStalls();
    const upload = renderMutation(() => useUploadVideo(), createQueryClient(), AppProviders);

    act(() => upload.current.start(ID, variables.request));
    await vi.waitFor(() => expect(axios.put).toHaveBeenCalledTimes(4));
    act(() => upload.current.cancel(ID));

    await vi.waitFor(() => expect(aborts).toEqual([UPLOAD_ID]));
    expect(axios.put).toHaveBeenCalledTimes(4);
  });

  it('cancels only the upload it names and lets the other one go on', async () => {
    answerUpload();
    storageStalls();
    const upload = renderMutation(() => useUploadVideo(), createQueryClient(), AppProviders);

    act(() => {
      upload.current.start(ID, variables.request);
      upload.current.start(SECOND_ID, secondRequest);
    });
    await vi.waitFor(() => expect(axios.put).toHaveBeenCalledTimes(2));
    act(() => upload.current.cancel(ID));

    expect(signalOfPut(variables.request.file)?.aborted).toBe(true);
    expect(signalOfPut(SECOND_FILE)?.aborted).toBe(false);
    act(() => upload.current.cancel(SECOND_ID));
  });

  it('settles every upload it starts, not only the latest', async () => {
    answerUpload();
    storageReportsHalfway();
    const settled: string[] = [];
    const upload = renderMutation(() => useUploadVideo(), createQueryClient(), AppProviders);

    act(() => {
      upload.current.start(ID, variables.request, { onSuccess: () => settled.push(ID) });
      upload.current.start(SECOND_ID, secondRequest, {
        onSuccess: () => settled.push(SECOND_ID),
      });
    });

    await vi.waitFor(() => expect(settled.toSorted()).toEqual([ID, SECOND_ID]));
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

      act(() => upload.current.start(ID, variables.request));
      await vi.waitFor(() => expect(axios.put).toHaveBeenCalled());
      pageHide(persisted);

      expect(keepalives()).toEqual(expected);
      act(() => upload.current.cancel(ID));
    }
  );

  it('sends no abort when the page closes while the upload is being completed', async () => {
    const onComplete = vi.fn();
    const completion = heldReply(() => undefined);
    answerUpload({ completion: completion.answer, onComplete });
    storageReportsHalfway();
    const keepalives = keepaliveOfAborts();
    const upload = renderMutation(() => useUploadVideo(), createQueryClient(), AppProviders);

    act(() => upload.current.start(ID, variables.request));
    await vi.waitFor(() => expect(onComplete).toHaveBeenCalled());
    pageHide(false);

    expect(keepalives()).toEqual([]);
    completion.release();
  });
});
