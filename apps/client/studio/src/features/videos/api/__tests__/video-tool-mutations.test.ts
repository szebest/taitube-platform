import { MutationObserver } from '@tanstack/react-query';
import { createQueryClient, videoKeys, videoToolKeys } from '@vp/queries';
import { VIDEO_ID, api, video } from '@vp/web-testing';
import { serveVideoTools } from '#app/features/videos/__tests__/video-tools-api.fixture';
import {
  addCorrectionMutationOptions,
  removeCorrectionMutationOptions,
  replaceChaptersMutationOptions,
  restoreRevisionMutationOptions,
  suggestChaptersMutationOptions,
} from '../video-tool-mutations';

const CHAPTERS = [
  { startMs: 0, title: 'A' },
  { startMs: 20_000, title: 'B' },
  { startMs: 40_000, title: 'C' },
];

describe('apps/client/studio: video tool mutations', () => {
  it('stores the video the chapter PUT answers with, so the editor shows it at once', async () => {
    serveVideoTools(video({ version: 1 }));
    const client = createQueryClient();

    await new MutationObserver(client, replaceChaptersMutationOptions(api, VIDEO_ID)).mutate({
      chapters: CHAPTERS,
      version: 1,
    });

    expect(
      client.getQueryData<{ chapters: unknown }>(videoKeys.detail(VIDEO_ID))?.chapters
    ).toEqual(CHAPTERS);
  });

  it('answers the suggestions without writing to the cache', async () => {
    serveVideoTools(video(), { suggestions: CHAPTERS });
    const client = createQueryClient();

    const result = await new MutationObserver(
      client,
      suggestChaptersMutationOptions(api, VIDEO_ID)
    ).mutate();

    expect(result.items).toEqual(CHAPTERS);
    expect(client.getQueryData(videoKeys.detail(VIDEO_ID))).toBeUndefined();
  });

  it.each([
    {
      name: 'restoring a revision',
      key: videoToolKeys.revisions(VIDEO_ID),
      run: (client: ReturnType<typeof createQueryClient>) =>
        new MutationObserver(client, restoreRevisionMutationOptions(api, VIDEO_ID)).mutate({
          revisionId: '0190c3a0-5e1d-7000-8000-00000000e001',
          version: 1,
        }),
    },
    {
      name: 'adding a correction',
      key: videoToolKeys.corrections(VIDEO_ID),
      run: (client: ReturnType<typeof createQueryClient>) =>
        new MutationObserver(client, addCorrectionMutationOptions(api, VIDEO_ID)).mutate({
          startMs: 0,
          endMs: 5000,
          text: 'x',
        }),
    },
    {
      name: 'removing a correction',
      key: videoToolKeys.corrections(VIDEO_ID),
      run: (client: ReturnType<typeof createQueryClient>) =>
        new MutationObserver(client, removeCorrectionMutationOptions(api, VIDEO_ID)).mutate(
          '0190c3a0-5e1d-7000-8000-00000000d001'
        ),
    },
  ])('refetches what $name changes', async ({ key, run }) => {
    serveVideoTools(video({ version: 1 }));
    const client = createQueryClient();
    client.setQueryData(key, { items: [] });

    await run(client);

    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  });
});
