import { MutationObserver, QueryClient } from '@tanstack/react-query';
import { transcriptQueryOptions, videoKeys } from '@vp/queries';
import { VIDEO_ID, api, apiServer, captionTrack, transcript } from '@vp/web-testing';
import { serveCaptions } from '#app/__tests__/captions-api.fixture';
import {
  autoCaptionsMutationOptions,
  deleteTrackMutationOptions,
  editCuesMutationOptions,
  generateMutationOptions,
  uploadTrackMutationOptions,
} from '../caption-mutations';

function seededClient() {
  const queryClient = new QueryClient();
  queryClient.setQueryData(videoKeys.captions(VIDEO_ID), { tracks: [] });
  queryClient.setQueryData(
    transcriptQueryOptions(api, VIDEO_ID, 'en').queryKey,
    transcript({ cues: [] })
  );
  return queryClient;
}

describe('apps/client/studio: caption mutations', () => {
  it.each([
    {
      write: 'an upload',
      run: (client: QueryClient) =>
        new MutationObserver(client, uploadTrackMutationOptions(api, VIDEO_ID)).mutate({
          language: 'en',
          vtt: 'WEBVTT\n',
        }),
    },
    {
      write: 'a cue edit',
      run: (client: QueryClient) =>
        new MutationObserver(client, editCuesMutationOptions(api, VIDEO_ID)).mutate({
          language: 'en',
          version: 3,
          cues: [{ index: 0, text: 'x' }],
        }),
    },
    {
      write: 'a delete',
      run: (client: QueryClient) =>
        new MutationObserver(client, deleteTrackMutationOptions(api, VIDEO_ID)).mutate('en'),
    },
    {
      write: 'a generate',
      run: (client: QueryClient) =>
        new MutationObserver(client, generateMutationOptions(api, VIDEO_ID)).mutate({
          language: 'en',
          overwrite: false,
        }),
    },
  ])('refetches the captions and their transcripts after $write', async ({ run }) => {
    apiServer.use(...serveCaptions({ tracks: [captionTrack({ version: 3 })] }).handlers);
    const queryClient = seededClient();

    await run(queryClient);

    expect(queryClient.getQueryState(videoKeys.captions(VIDEO_ID))?.isInvalidated).toBe(true);
    expect(
      queryClient.getQueryState(transcriptQueryOptions(api, VIDEO_ID, 'en').queryKey)?.isInvalidated
    ).toBe(true);
  });

  it('puts the list the switch answers with straight into the cache', async () => {
    apiServer.use(...serveCaptions().handlers);
    const queryClient = seededClient();

    await new MutationObserver(queryClient, autoCaptionsMutationOptions(api, VIDEO_ID)).mutate(
      false
    );

    expect(queryClient.getQueryData(videoKeys.captions(VIDEO_ID))).toMatchObject({
      settings: { autoCaptions: false },
    });
  });
});
