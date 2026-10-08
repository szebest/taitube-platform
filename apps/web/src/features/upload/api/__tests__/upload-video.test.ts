import {
  type ContractResult,
  completeUpload,
  issueUploadParts,
  startUpload,
} from '@vp/api-contracts';
import axios from 'axios';
import { HttpResponse } from 'msw';
import { VIDEO_ID } from '#app/__tests__/fixtures';
import { apiServer } from '#app/__tests__/msw/api-server';
import { mockEndpoint } from '#app/__tests__/msw/mock-endpoint';
import { uploadVideo } from '../upload-video';

const UPLOAD_ID = '0190c3a0-5e1d-7000-8000-00000000e001';
const EXPIRES_AT = '2026-01-01T01:00:00.000Z';

const request = {
  file: new File(['abcd'], 'clip.mp4'),
  filename: 'clip.mp4',
  sizeBytes: 4,
  contentType: 'video/mp4',
};

function answerUpload(started: ContractResult<typeof startUpload>) {
  const completions: unknown[] = [];
  const partRequests: string[] = [];
  apiServer.use(
    mockEndpoint(startUpload, () => HttpResponse.json(started, { status: 201 })),
    mockEndpoint(issueUploadParts, ({ request }) => {
      const { search, searchParams } = new URL(request.url);
      const from = Number(searchParams.get('from'));
      partRequests.push(search);
      return HttpResponse.json({
        parts: [
          {
            partNumber: from,
            url: `http://localhost:9000/raw/part-${from}`,
            expiresAt: EXPIRES_AT,
          },
        ],
      });
    }),
    mockEndpoint(completeUpload, async ({ request }) => {
      completions.push(await request.json());
      return HttpResponse.json(
        { videoId: VIDEO_ID, status: 'UPLOADED', admission: 'admitted' },
        { status: 202 }
      );
    })
  );
  return { completions, partRequests };
}

function storageAnswers() {
  return vi.spyOn(axios, 'put').mockImplementation(async (_url, _body, config) => {
    config?.onUploadProgress?.({
      loaded: 4,
      total: 4,
      progress: 1,
      bytes: 4,
      lengthComputable: true,
    });
    return { headers: { etag: '"part-etag"' } };
  });
}

describe('apps/web: uploadVideo', () => {
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
    const progress: number[] = [];

    const completed = await uploadVideo(request, (percent) => progress.push(percent));

    expect(put).toHaveBeenCalledWith(
      'http://localhost:9000/raw/source.mp4',
      request.file,
      expect.anything()
    );
    expect(completions).toEqual([{}]);
    expect(progress).toEqual([100]);
    expect(completed).toEqual({ videoId: VIDEO_ID, status: 'UPLOADED', admission: 'admitted' });
  });

  it('uploads every part, asking for the URLs it was not issued, and completes with the etags', async () => {
    storageAnswers();
    const { completions, partRequests } = answerUpload({
      videoId: VIDEO_ID,
      uploadId: UPLOAD_ID,
      strategy: 'multipart',
      partSizeBytes: 2,
      partsExpected: 2,
      parts: [{ partNumber: 1, url: 'http://localhost:9000/raw/part-1', expiresAt: EXPIRES_AT }],
      expiresAt: EXPIRES_AT,
    });
    const progress: number[] = [];

    await uploadVideo(request, (percent) => progress.push(percent));

    expect(partRequests).toEqual(['?from=2&count=100']);
    expect(completions).toEqual([
      {
        parts: [
          { partNumber: 1, etag: 'part-etag' },
          { partNumber: 2, etag: 'part-etag' },
        ],
      },
    ]);
    expect(progress).toEqual([50, 100]);
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

    await expect(uploadVideo(request, () => {})).rejects.toThrow(error);
  });
});
