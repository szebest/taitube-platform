import { QueryClient } from '@tanstack/react-query';
import { getPreferences, updatePreferences } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { apiServer, mockEndpoint, problemReply } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import { signedIn } from '#app/__tests__/providers';
import {
  preferencesView,
  SAVED_PLAYBACK,
} from '#app/features/settings/__tests__/preferences-fixtures';
import { useSavePreferences } from '../use-save-preferences';

const PREFERENCES_KEY = ['preferences'];

const CHANGE = { playback: { autoplayNext: false } };

const onSaved = vi.fn();
const onFailed = vi.fn();

const useSave = () => useSavePreferences({ onSaved, onFailed });

const save = (client: QueryClient) => runMutation(client, useSave, { change: CHANGE }, signedIn());

const cacheWith = (version: number) => {
  const client = new QueryClient();
  client.setQueryData(PREFERENCES_KEY, preferencesView({ version }));
  return client;
};

describe('useSavePreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends the change on the version the cache holds, and keeps the answer in the cache', async () => {
    const bodies: unknown[] = [];
    const saved = preferencesView({ version: 4, playback: SAVED_PLAYBACK });
    apiServer.use(
      mockEndpoint(updatePreferences, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(saved);
      })
    );
    const client = cacheWith(3);

    await save(client);

    expect(bodies).toEqual([{ ...CHANGE, version: 3 }]);
    expect(client.getQueryData(PREFERENCES_KEY)).toEqual(saved);
    expect(onSaved).toHaveBeenCalledWith(saved, CHANGE);
  });

  it('refetches the document on a version conflict, and sends the same change on it', async () => {
    const versions: number[] = [];
    const current = preferencesView({ version: 7 });
    apiServer.use(
      mockEndpoint(getPreferences, () => HttpResponse.json(current)),
      mockEndpoint(updatePreferences, async ({ request }) => {
        const { version } = (await request.json()) as { version: number };
        versions.push(version);
        return version === 7
          ? HttpResponse.json(preferencesView({ version: 8, playback: SAVED_PLAYBACK }))
          : problemReply(ErrorCodes.VERSION_CONFLICT);
      })
    );

    const outcome = await save(cacheWith(3));

    expect(outcome.status).toBe('fulfilled');
    expect(versions).toEqual([3, 7]);
  });

  it('puts the cached document back and reports the change when the save fails', async () => {
    apiServer.use(mockEndpoint(updatePreferences, () => problemReply(ErrorCodes.INTERNAL)));
    const client = cacheWith(3);

    const outcome = await save(client);

    expect(outcome.status).toBe('rejected');
    expect(client.getQueryData(PREFERENCES_KEY)).toEqual(preferencesView({ version: 3 }));
    expect(onFailed).toHaveBeenCalledWith(CHANGE);
  });
});
