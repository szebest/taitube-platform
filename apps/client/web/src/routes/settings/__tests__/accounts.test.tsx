import { serverRender } from '@vp/web-testing/server';
import { loaderApi } from '#app/__tests__/loader-api';
import { SESSION } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

const render = (headers?: HeadersInit) =>
  serverRender(getRouter, '/settings/accounts', { handlers: loaderApi(), headers });

describe('apps/client/web: /settings/accounts', () => {
  it('asks a guest to sign in, and comes back here once they have', async () => {
    const { status, main } = await render();

    expect(status).toBe(200);
    expect(main).toContain('>Accounts</h1>');
    expect(main).toMatch(
      /<a[^>]*href="\/login\?redirect=%2Fsettings%2Faccounts"[^>]*>Sign in<\/a>/
    );
  });

  it('gives a signed-in viewer the order, the colours, the channels and the sign-ins', async () => {
    const { main } = await render({ cookie: SESSION });

    expect(main).toContain('>Accounts</h1>');
    for (const row of ['Order and pins', 'Ring colours', 'Your channels', 'Sign-in history']) {
      expect(main).toContain(row);
    }
  });
});
