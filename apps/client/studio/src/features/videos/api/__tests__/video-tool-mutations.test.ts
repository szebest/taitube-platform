import { MutationObserver } from '@tanstack/react-query';
import {
  createQueryClient,
  shareLinksQueryOptions,
  videoKeys,
  videoQueryOptions,
  videoToolKeys,
} from '@vp/queries';
import { VIDEO_ID, api, video } from '@vp/web-testing';
import {
  experiment,
  serveExperiments,
} from '#app/features/videos/__tests__/experiments-api.fixture';
import { serveSharing, shareLink } from '#app/features/videos/__tests__/sharing-api.fixture';
import { serveVideoTools } from '#app/features/videos/__tests__/video-tools-api.fixture';
import {
  addCorrectionMutationOptions,
  applyExperimentMutationOptions,
  clearPasswordMutationOptions,
  createShareLinkMutationOptions,
  revokeShareLinkMutationOptions,
  removeCorrectionMutationOptions,
  replaceChaptersMutationOptions,
  restoreRevisionMutationOptions,
  setPasswordMutationOptions,
  startExperimentMutationOptions,
  stopExperimentMutationOptions,
  suggestChaptersMutationOptions,
  updateCorrectionMutationOptions,
} from '../video-tool-mutations';

type Client = ReturnType<typeof createQueryClient>;

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
      run: (client: Client) =>
        new MutationObserver(client, restoreRevisionMutationOptions(api, VIDEO_ID)).mutate({
          revisionId: '0190c3a0-5e1d-7000-8000-00000000e001',
          version: 1,
        }),
    },
    {
      name: 'adding a correction',
      key: videoToolKeys.corrections(VIDEO_ID),
      run: (client: Client) =>
        new MutationObserver(client, addCorrectionMutationOptions(api, VIDEO_ID)).mutate({
          startMs: 0,
          endMs: 5000,
          text: 'x',
        }),
    },
    {
      name: 'changing a correction',
      key: videoToolKeys.corrections(VIDEO_ID),
      run: (client: Client) =>
        new MutationObserver(client, updateCorrectionMutationOptions(api, VIDEO_ID)).mutate({
          correctionId: '0190c3a0-5e1d-7000-8000-00000000d001',
          changes: { text: 'y' },
        }),
    },
    {
      name: 'removing a correction',
      key: videoToolKeys.corrections(VIDEO_ID),
      run: (client: Client) =>
        new MutationObserver(client, removeCorrectionMutationOptions(api, VIDEO_ID)).mutate(
          '0190c3a0-5e1d-7000-8000-00000000d001'
        ),
    },
    {
      name: 'creating a share link',
      key: videoToolKeys.shareLinks(VIDEO_ID),
      run: (client: Client) =>
        new MutationObserver(client, createShareLinkMutationOptions(api, VIDEO_ID)).mutate({
          expiresIn: '7d',
        }),
    },
    {
      name: 'starting a test',
      key: videoToolKeys.experiments(VIDEO_ID),
      run: (client: Client) =>
        new MutationObserver(client, startExperimentMutationOptions(api, VIDEO_ID)).mutate({
          kind: 'title',
          variants: [{ title: 'A' }, { title: 'B' }],
        }),
    },
    {
      name: 'stopping a test',
      key: videoToolKeys.experiments(VIDEO_ID),
      run: (client: Client) =>
        new MutationObserver(client, stopExperimentMutationOptions(api, VIDEO_ID)).mutate(
          experiment().id
        ),
    },
  ])('refetches what $name changes', async ({ key, run }) => {
    serveVideoTools(video({ version: 1 }));
    serveSharing(video({ version: 1 }));
    serveExperiments(video({ version: 1 }));
    const client = createQueryClient();
    client.setQueryData(key, { items: [] });

    await run(client);

    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  });

  it('marks a link revoked in the cache before the API answers', async () => {
    serveSharing(video());
    const client = createQueryClient();
    const { queryKey } = shareLinksQueryOptions(api, VIDEO_ID);
    client.setQueryData(queryKey, { items: [shareLink()] });
    const options = revokeShareLinkMutationOptions(api, VIDEO_ID);

    await options.onMutate?.(shareLink().id, { client, meta: undefined });

    expect(client.getQueryData(queryKey)?.items[0]?.state).toBe('revoked');
  });

  it.each([
    { outcome: 'answers', revokeFails: false, expected: 'revoked' },
    { outcome: 'refuses', revokeFails: true, expected: 'active' },
  ])('leaves the link $expected when the API $outcome', async ({ revokeFails, expected }) => {
    serveSharing(video(), { revokeFails });
    const client = createQueryClient();
    const { queryKey } = shareLinksQueryOptions(api, VIDEO_ID);
    client.setQueryData(queryKey, { items: [shareLink()] });

    await new MutationObserver(client, revokeShareLinkMutationOptions(api, VIDEO_ID))
      .mutate(shareLink().id)
      .catch(() => undefined);

    expect(client.getQueryData(queryKey)?.items[0]?.state).toBe(expected);
  });

  it.each([
    {
      name: 'setting a password',
      protectedBefore: false,
      run: (client: Client) =>
        new MutationObserver(client, setPasswordMutationOptions(api, VIDEO_ID)).mutate('hunter22'),
      expected: true,
    },
    {
      name: 'removing the password',
      protectedBefore: true,
      run: (client: Client) =>
        new MutationObserver(client, clearPasswordMutationOptions(api, VIDEO_ID)).mutate(),
      expected: false,
    },
  ])('marks the video at once after $name', async ({ protectedBefore, run, expected }) => {
    serveSharing(video({ visibility: 'unlisted', passwordProtected: protectedBefore }));
    const client = createQueryClient();
    const { queryKey } = videoQueryOptions(api, VIDEO_ID);
    client.setQueryData(queryKey, video({ passwordProtected: protectedBefore }));

    await run(client);

    expect(client.getQueryData(queryKey)?.passwordProtected).toBe(expected);
  });

  it('applies a variant under the given version and stores the video it answers with', async () => {
    const { state } = serveExperiments(video({ version: 4, title: 'Launch day' }));
    const client = createQueryClient();

    await new MutationObserver(client, applyExperimentMutationOptions(api, VIDEO_ID)).mutate({
      experimentId: experiment().id,
      variantId: 'b',
      version: 4,
    });

    expect(state.applied).toEqual([{ variantId: 'b', version: 4 }]);
    expect(client.getQueryData(videoQueryOptions(api, VIDEO_ID).queryKey)?.title).toBe(
      'We launched'
    );
  });
});
