import { createQueryClient } from '@vp/queries';
import { api } from '@vp/web-testing';

import { editQuery, restoreQuery } from '../cached-query';
import { myPlaylistsQueryOptions } from '../library-queries';

const key = myPlaylistsQueryOptions(api).queryKey;
const rows = { items: [] };

describe('apps/client/web: editQuery and restoreQuery', () => {
  it('writes the edit and hands back what was there, to restore', async () => {
    const client = createQueryClient();
    client.setQueryData(key, { items: [] });

    const snapshot = await editQuery(client, key, () => ({ ...rows, items: [] }));
    expect(snapshot.previous).toEqual(rows);

    client.setQueryData(key, { items: [] });
    restoreQuery(client, key, snapshot);
    expect(client.getQueryData(key)).toBe(snapshot.previous);
  });

  it('edits nothing for a query that was never loaded, and restores it to unloaded', async () => {
    const client = createQueryClient();

    const snapshot = await editQuery(client, key, () => rows);
    restoreQuery(client, key, snapshot);

    expect(client.getQueryData(key)).toBeUndefined();
  });
});
