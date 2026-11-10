import { MutationObserver } from '@tanstack/react-query';
import { getMySpotlight, setMySpotlight } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, CHANNEL_ID, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw';
import { saveSpotlightMutationOptions, spotlightQueryOptions } from '../channel-spotlight';

const VIDEO = '0190c3a0-5e1d-7000-8000-00000000a001';
const EMPTY = { trailerVideoId: null, returningVideoId: null, localizations: [] };

describe('apps/client/studio: channel spotlight queries', () => {
  it('reads what the channel saved', async () => {
    apiServer.use(mockEndpoint(getMySpotlight, () => HttpResponse.json(EMPTY)));

    expect(await createQueryClient().query(spotlightQueryOptions(api, CHANNEL_ID))).toEqual(EMPTY);
  });

  it('writes the saved settings into the cache', async () => {
    const saved = { ...EMPTY, trailerVideoId: VIDEO };
    apiServer.use(mockEndpoint(setMySpotlight, () => HttpResponse.json(saved)));
    const client = createQueryClient();

    await new MutationObserver(client, saveSpotlightMutationOptions(api, CHANNEL_ID)).mutate(saved);

    expect(client.getQueryData(spotlightQueryOptions(api, CHANNEL_ID).queryKey)).toEqual(saved);
  });
});
