import { completeUpload, startUpload } from '@vp/api-contracts';
import axios from 'axios';
import { HttpResponse } from 'msw/http';
import { VIDEO_ID } from '#app/__tests__/fixtures';
import { apiServer } from '#app/__tests__/msw/api-server';
import { mockEndpoint } from '#app/__tests__/msw/mock-endpoint';
import { renderMutation, runMutation } from '#app/__tests__/render-mutation';
import { publicFeedQueryOptions } from '#app/features/feed/api/feed-queries';
import { myVideosQueryOptions } from '#app/features/videos/api/video-queries';
import { createQueryClient } from '#app/integrations/query/create-query-client';
import { useUploadVideo } from '../use-upload-video';

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

describe('apps/web: useUploadVideo', () => {
  it('holds the transfer progress the storage reported', async () => {
    answerUpload();
    storageReportsHalfway();
    const upload = renderMutation(() => useUploadVideo(), createQueryClient());

    expect(upload.current.progress).toBe(0);
    const completed = await upload.current.mutateAsync(request);

    expect(completed).toEqual({ videoId: VIDEO_ID, status: 'UPLOADED' });
    await vi.waitFor(() => expect(upload.current.progress).toBe(50));
  });

  it("marks the caller's videos and the feeds stale once the upload settles", async () => {
    answerUpload();
    storageReportsHalfway();
    const listKeys = [
      myVideosQueryOptions().queryKey,
      publicFeedQueryOptions({ sort: 'recent' }).queryKey,
    ];
    const client = createQueryClient();
    for (const queryKey of listKeys) client.setQueryData(queryKey, { pages: [], pageParams: [] });

    await runMutation(client, () => useUploadVideo(), request);

    for (const queryKey of listKeys) {
      expect(client.getQueryState(queryKey)?.isInvalidated).toBe(true);
    }
  });
});
