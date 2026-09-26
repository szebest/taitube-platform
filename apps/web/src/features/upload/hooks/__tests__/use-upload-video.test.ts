import { completeUpload, startUpload } from '@vp/api-contracts';
import axios from 'axios';
import { HttpResponse } from 'msw';
import { VIDEO_ID } from '#app/__tests__/fixtures';
import { apiServer } from '#app/__tests__/msw/api-server';
import { mockEndpoint } from '#app/__tests__/msw/mock-endpoint';
import { runMutation } from '#app/__tests__/run-mutation';
import { publicFeedQueryOptions } from '#app/features/feed/api/feed-queries';
import { myVideosQueryOptions } from '#app/features/videos/api/video-queries';
import { createQueryClient } from '#app/integrations/query/create-query-client';
import { uploadVideoMutationOptions } from '../use-upload-video';

const UPLOAD_ID = '0190c3a0-5e1d-7000-8000-00000000e001';

const request = {
  file: new File(['abcd'], 'clip.mp4', { type: 'video/mp4' }),
  filename: 'clip.mp4',
  sizeBytes: 4,
  contentType: 'video/mp4',
  title: 'Clip',
};

function answerUpload() {
  apiServer.use(
    mockEndpoint(startUpload, () =>
      HttpResponse.json(
        {
          videoId: VIDEO_ID,
          uploadId: UPLOAD_ID,
          strategy: 'single',
          singleUrl: 'http://localhost:9000/raw/source.mp4',
          expiresAt: '2026-01-01T01:00:00.000Z',
        },
        { status: 201 }
      )
    ),
    mockEndpoint(completeUpload, () => HttpResponse.json({ videoId: VIDEO_ID, status: 'UPLOADED' }))
  );
}

function storageReportsHalfway() {
  vi.spyOn(axios, 'put').mockImplementation(async (_url, _file, config) => {
    config?.onUploadProgress?.({ loaded: 2, total: 4, progress: 0.5, bytes: 2, lengthComputable: true });
    return { headers: {} };
  });
}

describe('apps/web: uploadVideoMutationOptions', () => {
  it('reports the transfer progress, starting from zero', async () => {
    answerUpload();
    storageReportsHalfway();
    const progress: number[] = [];

    const settled = await runMutation(
      createQueryClient(),
      uploadVideoMutationOptions((percent) => progress.push(percent)),
      request
    );

    expect(settled).toEqual({ status: 'fulfilled', value: { videoId: VIDEO_ID, status: 'UPLOADED' } });
    expect(progress).toEqual([0, 50]);
  });

  it("marks the caller's videos and the feeds stale once the upload settles", async () => {
    answerUpload();
    storageReportsHalfway();
    const listKeys = [myVideosQueryOptions().queryKey, publicFeedQueryOptions({ sort: 'recent' }).queryKey];
    const client = createQueryClient();
    for (const queryKey of listKeys) client.setQueryData(queryKey, { pages: [], pageParams: [] });

    await runMutation(client, uploadVideoMutationOptions(() => {}), request);

    for (const queryKey of listKeys) {
      expect(client.getQueryState(queryKey)?.isInvalidated).toBe(true);
    }
  });
});
