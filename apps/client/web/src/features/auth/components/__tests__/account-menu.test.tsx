import { renderPage } from '@vp/web-testing/server';

import { signedIn } from '#app/__tests__/providers';
import { AccountMenu } from '../account-menu';

const renderMenu = (Providers = signedIn()) => renderPage(<AccountMenu />, Providers);

describe('apps/client/web: account menu', () => {
  it("links the signed-in viewer to the studio's upload page", async () => {
    expect(await renderMenu()).toContain('href="http://localhost:5174/upload"');
  });
});
