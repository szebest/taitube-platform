import { getCurrentPick, getHome } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, fallbackPick, mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { currentPickQueryOptions, homeKeys, homeQueryOptions } from '../home-queries';

describe('apps/client/web: home queries', () => {
  it('reads the home shelves', async () => {
    apiServer.use(mockEndpoint(getHome, () => HttpResponse.json({ shelves: [] })));

    await expect(createQueryClient().fetchQuery(homeQueryOptions(api))).resolves.toEqual({
      shelves: [],
    });
  });

  it('reads the current pick', async () => {
    apiServer.use(mockEndpoint(getCurrentPick, () => HttpResponse.json(fallbackPick())));

    await expect(createQueryClient().fetchQuery(currentPickQueryOptions(api))).resolves.toEqual(
      fallbackPick()
    );
  });

  it('reads nothing scheduled and nothing trending as no pick', async () => {
    apiServer.use(mockEndpoint(getCurrentPick, () => problemReply(ErrorCodes.VIDEO_NOT_FOUND)));

    await expect(
      createQueryClient().fetchQuery(currentPickQueryOptions(api))
    ).resolves.toBeNull();
  });

  it('fails on any other error', async () => {
    apiServer.use(mockEndpoint(getCurrentPick, () => problemReply(ErrorCodes.INTERNAL)));

    await expect(createQueryClient().fetchQuery(currentPickQueryOptions(api))).rejects.toThrow();
  });

  it.each([
    { name: 'the shelves', key: homeKeys.shelves() },
    { name: 'the pick', key: homeKeys.pick() },
  ])('keeps $name under the home key', ({ key }) => {
    expect(key.slice(0, homeKeys.all.length)).toEqual(homeKeys.all);
  });
});
