import { listDlq } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import { dlqEntry, dlqList } from '#app/features/admin/components/__tests__/queues.fixture';
import {
  adminDlqQueryOptions,
  DlqSearchSchema,
  knownDlqStatus,
  parkedDlqQueryOptions,
} from '../admin-dlq';

describe('apps/client/studio: adminDlqQueryOptions', () => {
  it('asks for the one status and keys the list by it', async () => {
    const queries: URLSearchParams[] = [];
    const replayed = dlqEntry({ status: 'REPLAYED' });
    apiServer.use(dlqList([dlqEntry(), replayed], queries));
    const options = adminDlqQueryOptions(api, 'REPLAYED');

    const data = await createQueryClient().fetchInfiniteQuery(options);

    expect(options.queryKey).toEqual(['admin', 'dlq', 'list', 'REPLAYED']);
    expect(queries[0]?.get('status')).toBe('REPLAYED');
    expect(data.pages[0]?.items).toEqual([replayed]);
  });
});

describe('apps/client/studio: parkedDlqQueryOptions', () => {
  it.each([
    { scenario: 'is the whole queue', nextCursor: null, more: false },
    { scenario: 'overflows a page', nextCursor: 'next', more: true },
  ])('counts the parked first page when it $scenario', async ({ nextCursor, more }) => {
    const queries: URLSearchParams[] = [];
    apiServer.use(
      mockEndpoint(listDlq, ({ request }) => {
        queries.push(new URL(request.url).searchParams);
        return HttpResponse.json({ items: [dlqEntry(), dlqEntry()], nextCursor });
      })
    );

    const result = await createQueryClient().fetchQuery(parkedDlqQueryOptions(api));

    expect(queries[0]?.get('status')).toBe('PARKED');
    expect(result).toEqual({ count: 2, more });
  });
});

describe('apps/client/studio: DlqSearchSchema', () => {
  it.each([
    { search: { status: 'PARKED' }, status: 'PARKED' },
    { search: { status: 'LOST' }, status: undefined },
    { search: {}, status: undefined },
  ])('reads $search as $status', ({ search, status }) => {
    expect(DlqSearchSchema.parse(search)).toEqual({ status });
  });
});

describe('apps/client/studio: knownDlqStatus', () => {
  it.each([
    { status: 'DISCARDED', known: 'DISCARDED' },
    { status: 'EXPLODED', known: undefined },
  ])('reads $status as $known', ({ status, known }) => {
    expect(knownDlqStatus(dlqEntry({ status }))).toBe(known);
  });
});
