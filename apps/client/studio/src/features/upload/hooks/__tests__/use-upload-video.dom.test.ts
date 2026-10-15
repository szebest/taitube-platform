import { completeUpload, startUpload } from '@vp/api-contracts';
import { createQueryClient, myVideosQueryOptions } from '@vp/queries';
import { VIDEO_ID, apiServer } from '@vp/web-testing';
import { renderMutation, runMutation } from '@vp/web-testing/dom';
import axios from 'axios';
import { HttpResponse } from 'msw/http';
import { WithApi, api, mockEndpoint } from '#app/__tests__/api';
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

describe('apps/client/studio: useUploadVideo', () => {
  it('holds the transfer progress the storage reported', async () => {
    answerUpload();
    storageReportsHalfway();
    const upload = renderMutation(() => useUploadVideo(), createQueryClient(), WithApi);

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

    await runMutation(client, () => useUploadVideo(), request, WithApi);

    expect(client.getQueryState(mineKey)?.isInvalidated).toBe(true);
  });
});
