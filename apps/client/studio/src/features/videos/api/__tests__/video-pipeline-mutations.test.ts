import { MutationObserver } from '@tanstack/react-query';
import { createQueryClient, videoKeys } from '@vp/queries';
import { VIDEO_ID, api, video } from '@vp/web-testing';
import axios from 'axios';
import {
  UPLOAD_URL,
  servePipeline,
} from '#app/features/videos/__tests__/video-pipeline-api.fixture';
import {
  createClipMutationOptions,
  replaceFileMutationOptions,
  revertEditsMutationOptions,
  saveEditsMutationOptions,
} from '../video-pipeline-mutations';

describe('apps/client/studio: video pipeline mutations', () => {
  it('uploads into the presigned address, reports the share sent, then starts the render', async () => {
    const { state } = servePipeline(video());
    const put = vi.spyOn(axios, 'put').mockImplementation(async (_url, _file, config) => {
      config?.onUploadProgress?.({ loaded: 5, total: 10, bytes: 5, lengthComputable: true });
      return {};
    });
    const progress: number[] = [];
    const file = new File(['0123456789'], 'retake.mp4', { type: 'video/mp4' });

    const result = await new MutationObserver(
      createQueryClient(),
      replaceFileMutationOptions(api, VIDEO_ID)
    ).mutate({ file, onProgress: (share) => progress.push(share) });

    expect(put).toHaveBeenCalledWith(UPLOAD_URL, file, expect.anything());
    expect(progress).toEqual([0.5]);
    expect(state.completed).toEqual([{ generation: 2 }]);
    expect(result).toEqual({ generation: 2, status: 'rendering' });
  });

  it.each([
    {
      name: 'saving the edits',
      run: (client: ReturnType<typeof createQueryClient>) =>
        new MutationObserver(client, saveEditsMutationOptions(api, VIDEO_ID)).mutate({
          trim: { startMs: 0, endMs: 5_000 },
          blurs: [],
        }),
    },
    {
      name: 'reverting them',
      run: (client: ReturnType<typeof createQueryClient>) =>
        new MutationObserver(client, revertEditsMutationOptions(api, VIDEO_ID)).mutate(4),
    },
  ])('refreshes the video after $name', async ({ run }) => {
    servePipeline(video({ version: 4 }));
    const client = createQueryClient();
    client.setQueryData(videoKeys.detail(VIDEO_ID), video());

    await run(client);

    expect(client.getQueryState(videoKeys.detail(VIDEO_ID))?.isInvalidated).toBe(true);
  });

  it('creates a clip through the clips endpoint', async () => {
    const { state } = servePipeline(video());
    const body = { startMs: 30_000, endMs: 60_000, title: 'The good part' };

    await new MutationObserver(
      createQueryClient(),
      createClipMutationOptions(api, VIDEO_ID)
    ).mutate(body);

    expect(state.clips).toEqual([body]);
  });
});
