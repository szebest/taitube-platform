import { queryOptions } from '@tanstack/react-query';
import { createQueryClient } from '../create-query-client';
import { restoreQueryData } from '../restore-query-data';

const { queryKey } = queryOptions({ queryKey: ['restored'], queryFn: async () => 'server' });

describe('apps/web: restoreQueryData', () => {
  it('puts the snapshot back over an optimistic write', () => {
    const client = createQueryClient();
    client.setQueryData(queryKey, 'optimistic');

    restoreQueryData(client, queryKey, 'snapshot');

    expect(client.getQueryData(queryKey)).toBe('snapshot');
  });

  it('drops the entry when there was nothing cached to restore', () => {
    const client = createQueryClient();
    client.setQueryData(queryKey, 'optimistic');

    restoreQueryData(client, queryKey, undefined);

    expect(client.getQueryCache().find({ queryKey })).toBeUndefined();
  });
});
