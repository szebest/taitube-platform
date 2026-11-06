import { serverRender } from '@vp/web-testing/server';

import { accountOf, SESSION } from '#app/__tests__/providers';
import { liveApi } from '#app/features/live/__tests__/live-api.fixture';
import { getRouter } from '#app/router';

describe('apps/client/studio: /live on the server', () => {
  it("renders the creator's stream from the server, with the stream key masked", async () => {
    const { status, main } = await serverRender(getRouter, '/live', {
      handlers: [accountOf(), ...liveApi().handlers],
      headers: { cookie: SESSION },
    });

    expect(status).toBe(200);
    expect(main).toContain('Friday build night');
    expect(main).toContain('type="password"');
  });
});
