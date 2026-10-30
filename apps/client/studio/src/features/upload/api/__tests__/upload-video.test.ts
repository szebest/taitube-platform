import {
  abortUpload,
  type ContractResult,
  completeUpload,
  issueUploadParts,
  startUpload,
} from '@vp/api-contracts';
import { api, apiServer, mockEndpoint, VIDEO_ID } from '@vp/web-testing';
import axios from 'axios';
import { HttpResponse } from 'msw/http';
import type { UploadProgress } from '../upload-progress';
import { uploadVideo } from '../upload-video';

const UPLOAD_ID = '0190c3a0-5e1d-7000-8000-00000000e001';
const EXPIRES_AT = '2026-01-01T01:00:00.000Z';

const request = {
  file: new File(['abcd'], 'clip.mp4'),
  filename: 'clip.mp4',
  sizeBytes: 4,
  contentType: 'video/mp4',
};

const partUrl = (partNumber: number) => `http://localhost:9000/raw/part-${partNumber}`;
const partNumberOf = (url: unknown) => Number(String(url).split('-').at(-1));

function multipart(partsExpected: number, issued = 0) {
  return {
    videoId: VIDEO_ID,
    uploadId: UPLOAD_ID,
    strategy: 'multipart' as const,
    partSizeBytes: 1,
    partsExpected,
    parts: Array.from({ length: issued }, (_, index) => ({
      partNumber: index + 1,
      url: partUrl(index + 1),
      expiresAt: EXPIRES_AT,
    })),
    expiresAt: EXPIRES_AT,
  };
}

function fileOf(size: number) {
  return { ...request, file: new File(['x'.repeat(size)], 'clip.mp4'), sizeBytes: size };
}

function answerUpload(started: ContractResult<typeof startUpload>) {
  const completions: unknown[] = [];
  const partRequests: string[] = [];
  const aborts: string[] = [];
  apiServer.use(
    mockEndpoint(startUpload, () => HttpResponse.json(started, { status: 201 })),
    mockEndpoint(issueUploadParts, ({ request }) => {
      const { search, searchParams } = new URL(request.url);
      const from = Number(searchParams.get('from'));
      const count = Number(searchParams.get('count'));
      partRequests.push(search);
      return HttpResponse.json({
        parts: Array.from({ length: count }, (_, offset) => ({
          partNumber: from + offset,
          url: partUrl(from + offset),
          expiresAt: EXPIRES_AT,
        })),
      });
    }),
    mockEndpoint(abortUpload, ({ params }) => {
      aborts.push(String(params['uploadId']));
      return new HttpResponse(null, { status: 204 });
    }),
    mockEndpoint(completeUpload, async ({ request }) => {
      completions.push(await request.json());
      return HttpResponse.json(
        { videoId: VIDEO_ID, status: 'UPLOADED', admission: 'admitted' },
        { status: 202 }
      );
    })
  );
  return { completions, partRequests, aborts };
}

function storageAnswers() {
  return vi.spyOn(axios, 'put').mockImplementation(async (_url, body, config) => {
    const { size } = body as Blob;
    config?.onUploadProgress?.({
      loaded: size,
      total: size,
      progress: 1,
      bytes: size,
      lengthComputable: true,
    });
    return { headers: { etag: '"part-etag"' } };
  });
}

function storageHoldsParts() {
  let open = 0;
  let mostOpen = 0;
  const started: number[] = [];
  const holds: { partNumber: number; release: () => void; fail: (cause: Error) => void }[] = [];
  vi.spyOn(axios, 'put').mockImplementation(
    (url, _body, config) =>
      new Promise((resolve, reject) => {
        started.push(partNumberOf(url));
        open += 1;
        mostOpen = Math.max(mostOpen, open);
        config?.signal?.addEventListener?.('abort', () => {
          open -= 1;
          reject(new axios.CanceledError());
        });
        const release = () => {
          open -= 1;
          resolve({ headers: { etag: `"etag-${partNumberOf(url)}"` } });
        };
        holds.push({
          partNumber: partNumberOf(url),
          release,
          fail: (cause) => {
            open -= 1;
            reject(cause);
          },
        });
      })
  );
  return { holds, started, mostOpen: () => mostOpen };
}

describe('apps/client/studio: uploadVideo', () => {
  it('PUTs the whole file and completes with no parts on the single strategy', async () => {
    const put = storageAnswers();
    const { completions } = answerUpload({
      videoId: VIDEO_ID,
      uploadId: UPLOAD_ID,
      strategy: 'single',
      singleUrl: 'http://localhost:9000/raw/source.mp4',
      headers: { 'content-type': 'video/mp4' },
      expiresAt: EXPIRES_AT,
    });
    const progress: UploadProgress[] = [];

    const completed = await uploadVideo(api, request, (reported) => progress.push(reported));

    expect(put).toHaveBeenCalledWith(
      'http://localhost:9000/raw/source.mp4',
      request.file,
      expect.anything()
    );
    expect(completions).toEqual([{}]);
    expect(progress).toEqual([{ loaded: 4, total: 4 }]);
    expect(completed).toEqual({ videoId: VIDEO_ID, status: 'UPLOADED', admission: 'admitted' });
  });

  it('uploads every part, asking for the URLs it was not issued, and completes with the etags', async () => {
    storageAnswers();
    const { completions, partRequests } = answerUpload(multipart(2, 1));
    const progress: UploadProgress[] = [];

    await uploadVideo(api, fileOf(2), (reported) => progress.push(reported));

    expect(partRequests).toEqual(['?from=2&count=100']);
    expect(completions).toEqual([
      {
        parts: [
          { partNumber: 1, etag: 'part-etag' },
          { partNumber: 2, etag: 'part-etag' },
        ],
      },
    ]);
    expect(progress.at(-1)).toEqual({ loaded: 2, total: 2 });
  });

  it('keeps four parts in flight, never reports fewer bytes, and completes with the parts sorted', async () => {
    const { holds, mostOpen, started } = storageHoldsParts();
    const { completions } = answerUpload(multipart(8, 8));
    const progress: UploadProgress[] = [];

    const uploading = uploadVideo(api, fileOf(8), (reported) => progress.push(reported));
    await vi.waitFor(() => expect(started).toEqual([1, 2, 3, 4]));
    for (const partNumber of [4, 2, 3, 1])
      holds.find((hold) => hold.partNumber === partNumber)?.release();
    await vi.waitFor(() => expect(started).toHaveLength(8));
    for (const partNumber of [8, 5, 7, 6])
      holds.find((hold) => hold.partNumber === partNumber)?.release();
    await uploading;

    expect(mostOpen()).toBe(4);
    const loaded = progress.map((reported) => reported.loaded);
    expect(loaded).toEqual([...loaded].sort((a, b) => a - b));
    expect(progress.at(-1)).toEqual({ loaded: 8, total: 8 });
    expect(completions).toEqual([
      {
        parts: Array.from({ length: 8 }, (_, index) => ({
          partNumber: index + 1,
          etag: `etag-${index + 1}`,
        })),
      },
    ]);
  });

  it('issues each batch of part URLs once however many parts ask for it', async () => {
    storageAnswers();
    const { partRequests } = answerUpload(multipart(250));

    await uploadVideo(api, fileOf(250), () => {});

    expect(partRequests).toEqual([
      '?from=1&count=100',
      '?from=101&count=100',
      '?from=201&count=100',
    ]);
  });

  it.each([
    {
      upload: 'a single upload the API issued no URL for',
      started: { strategy: 'single' as const },
      error: /did not issue an upload URL/,
    },
    {
      upload: 'a multipart upload the API did not size',
      started: { strategy: 'multipart' as const, partsExpected: 2, parts: [] },
      error: /did not report a part size/,
    },
  ])('refuses $upload', async ({ started, error }) => {
    answerUpload({ videoId: VIDEO_ID, uploadId: UPLOAD_ID, expiresAt: EXPIRES_AT, ...started });

    await expect(uploadVideo(api, request, () => {})).rejects.toThrow(error);
  });

  it('stops every part and starts no new one when a part fails, and aborts the upload once', async () => {
    const { holds, started } = storageHoldsParts();
    const { completions, aborts } = answerUpload(multipart(8, 8));
    const uploading = uploadVideo(api, fileOf(8), () => {});
    const outcome = expect(uploading).rejects.toThrow('storage refused part 2');

    await vi.waitFor(() => expect(started).toHaveLength(4));
    holds.find((hold) => hold.partNumber === 2)?.fail(new Error('storage refused part 2'));
    await outcome;

    expect(started).toEqual([1, 2, 3, 4]);
    expect(completions).toEqual([]);
    expect(aborts).toEqual([UPLOAD_ID]);
  });

  it('stops every part and aborts the upload once when the caller cancels after the first part', async () => {
    const controller = new AbortController();
    const { holds, started } = storageHoldsParts();
    const { completions, aborts } = answerUpload(multipart(8, 8));
    const uploading = uploadVideo(api, fileOf(8), () => {}, { signal: controller.signal });
    const outcome = expect(uploading).rejects.toThrow();

    await vi.waitFor(() => expect(started).toHaveLength(4));
    holds.find((hold) => hold.partNumber === 1)?.release();
    await vi.waitFor(() => expect(started).toHaveLength(5));
    controller.abort();
    await outcome;

    expect(started).toEqual([1, 2, 3, 4, 5]);
    expect(completions).toEqual([]);
    expect(aborts).toEqual([UPLOAD_ID]);
  });

  it('reports the upload id once the API has opened it, and aborts nothing when it completes', async () => {
    storageAnswers();
    const { aborts } = answerUpload({
      videoId: VIDEO_ID,
      uploadId: UPLOAD_ID,
      strategy: 'single',
      singleUrl: 'http://localhost:9000/raw/source.mp4',
      expiresAt: EXPIRES_AT,
    });
    const onStarted = vi.fn();

    await uploadVideo(api, request, () => {}, { onStarted });

    expect(onStarted).toHaveBeenCalledWith(UPLOAD_ID);
    expect(aborts).toEqual([]);
  });
});
