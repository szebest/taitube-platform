import * as start from '@tanstack/react-start';
import { getCookie, requestHandler } from '@tanstack/react-start/server';

import { inRenderedRequest } from '../server-functions';

const createServerFn = inRenderedRequest(start);

const recall = createServerFn().handler(() => getCookie('kept') ?? null);

describe('@vp/web-testing: server functions on the server', () => {
  it('reads the request the spec is rendering', async () => {
    const answer = requestHandler(async () => Response.json(await recall()));

    const response = await answer(
      new Request('http://localhost/', { headers: { cookie: 'kept=1' } }),
      {}
    );

    expect(await response.json()).toBe('1');
  });
});
