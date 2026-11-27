import { describeFetchContract, type FetchSubject } from '../contract';
import { Fetch } from '../tokens';
import { providedBy, resolveFrom } from './providers';

const subjectOf = (providers: ReturnType<(typeof providedBy)['node']>): FetchSubject => {
  const transport = vi.spyOn(globalThis, 'fetch');

  return {
    fetch: resolveFrom(providers, Fetch),
    serve: (body, status = 200) => {
      transport.mockImplementation(async () => new Response(body, { status }));
    },
    requests: () => transport.mock.calls.map(([input, init]) => ({ input, init })),
  };
};

describe('@kit/runtime/node: Fetch', () => {
  describeFetchContract(() => subjectOf(providedBy.node()));
});

describe('@kit/runtime/browser: Fetch', () => {
  describeFetchContract(() => subjectOf(providedBy.browser()));
});
