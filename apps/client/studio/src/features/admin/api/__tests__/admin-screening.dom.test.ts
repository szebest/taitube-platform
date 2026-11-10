import { listScreeningCases } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { screeningCase } from '#app/features/admin/__tests__/screening.fixture';
import {
  adminScreeningQueryOptions,
  ScreeningSearchSchema,
  screeningStateOf,
} from '../admin-screening';

describe('apps/client/studio: adminScreeningQueryOptions', () => {
  it('sends the filter with the page size, keyed by it under the key the decisions invalidate', async () => {
    const queries: URLSearchParams[] = [];
    const first = screeningCase();
    apiServer.use(
      mockEndpoint(listScreeningCases, ({ request }) => {
        queries.push(new URL(request.url).searchParams);
        return HttpResponse.json({ items: [first], nextCursor: 'next' });
      })
    );
    const options = adminScreeningQueryOptions(api, 'open');

    const data = await createQueryClient().infiniteQuery(options);

    expect(options.queryKey).toEqual(['admin', 'screening', 'open']);
    expect(Object.fromEntries(queries[0] ?? [])).toEqual({ state: 'open', limit: '30' });
    expect(data.pages[0]?.items).toEqual([first]);
    expect(data.pages[0]?.nextCursor).toBe('next');
  });
});

describe('apps/client/studio: ScreeningSearchSchema', () => {
  it.each([
    { case: 'keeps a state the contract allows', state: 'decided', parsed: 'decided' },
    { case: 'reads a state the contract refuses as absent', state: 'old', parsed: undefined },
    { case: 'reads no state as absent', state: undefined, parsed: undefined },
  ])('$case', ({ state, parsed }) => {
    expect(ScreeningSearchSchema.parse({ state })).toEqual({ state: parsed });
  });
});

describe('apps/client/studio: screeningStateOf', () => {
  const waiting = {
    message: 'Mistake',
    createdAt: '',
    rejectedBy: null,
    resolvedAt: null,
  } as never;

  it.each([
    {
      case: 'is the decision once one was made',
      screening: { decision: 'approved', outcome: 'HOLD', appeal: null },
      state: 'approved',
    },
    {
      case: 'is appealed while an appeal waits',
      screening: { decision: null, outcome: 'HOLD', appeal: waiting },
      state: 'appealed',
    },
    {
      case: 'is held for a hold nobody decided',
      screening: { decision: null, outcome: 'HOLD', appeal: null },
      state: 'held',
    },
    {
      case: 'is flagged for a pass with flags',
      screening: { decision: null, outcome: 'PASS', appeal: null },
      state: 'flagged',
    },
  ] as const)('$case', ({ screening, state }) => {
    expect(screeningStateOf(screening)).toBe(state);
  });
});
