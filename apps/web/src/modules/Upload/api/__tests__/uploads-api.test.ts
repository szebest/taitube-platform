import axios from 'axios';
import { createApiStore, jsonResponse, recordRequests } from '../../../../__tests__/api-store';
import { VIDEO_ID } from '../../../../__tests__/fixtures';
import { API_BASE_URL } from '../../../../config';
import { uploadsApi } from '../uploads-api';

const UPLOAD_ID = '0190c3a0-5e1d-7000-8000-00000000e001';

const started = {
  videoId: VIDEO_ID,
  uploadId: UPLOAD_ID,
  strategy: 'single',
  singleUrl: 'http://localhost:9000/raw/source.mp4',
  expiresAt: '2026-01-01T01:00:00.000Z',
};
const completed = { videoId: VIDEO_ID, status: 'UPLOADED' };

function answerUpload(url: string): Response {
  return jsonResponse(url.endsWith('/complete') ? completed : started);
}

const request = {
  file: new File(['abcd'], 'clip.mp4', { type: 'video/mp4' }),
  filename: 'clip.mp4',
  sizeBytes: 4,
  contentType: 'video/mp4',
  title: 'Clip',
};

describe('apps/web: uploads api', () => {
  it('reports no progress before an upload starts', async () => {
    const progress = await createApiStore().dispatch(uploadsApi.endpoints.uploadProgress.initiate());

    expect(progress.data).toBe(0);
  });

  it('starts the upload without the bytes, completes it and returns the finished video', async () => {
    const sent = recordRequests(answerUpload);
    vi.spyOn(axios, 'put').mockResolvedValue({ headers: {} });

    const upload = createApiStore().dispatch(uploadsApi.endpoints.uploadVideo.initiate(request));

    await expect(upload.unwrap()).resolves.toEqual(completed);
    expect(sent).toEqual([
      {
        method: 'POST',
        url: `${API_BASE_URL}/v1/uploads`,
        body: { filename: 'clip.mp4', sizeBytes: 4, contentType: 'video/mp4', title: 'Clip' },
      },
      { method: 'POST', url: `${API_BASE_URL}/v1/uploads/${UPLOAD_ID}/complete`, body: {} },
    ]);
  });

  it('publishes the transfer progress to the progress query', async () => {
    recordRequests(answerUpload);
    vi.spyOn(axios, 'put').mockImplementation(async (_url, _file, config) => {
      config?.onUploadProgress?.({ loaded: 2, total: 4, progress: 0.5, bytes: 2, lengthComputable: true });
      return { headers: {} };
    });
    const store = createApiStore();

    await store.dispatch(uploadsApi.endpoints.uploadProgress.initiate());
    await store.dispatch(uploadsApi.endpoints.uploadVideo.initiate(request));
    const progress = await store.dispatch(uploadsApi.endpoints.uploadProgress.initiate());

    expect(progress.data).toBe(50);
  });

  it('surfaces an upload the API gave no URL for as a failed mutation', async () => {
    recordRequests(() => jsonResponse({ ...started, singleUrl: undefined }));

    const upload = createApiStore().dispatch(uploadsApi.endpoints.uploadVideo.initiate(request));

    await expect(upload.unwrap()).rejects.toEqual({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'The API did not issue an upload URL for this file',
    });
  });
});
