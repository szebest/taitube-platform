import { renderPage } from '@vp/web-testing/server';

import { signedIn } from '#app/__tests__/providers';
import { AccountMenu } from '../account-menu';

describe('apps/client/web: account menu', () => {
  it("links the signed-in viewer to the studio's upload page", async () => {
    expect(await renderPage(<AccountMenu />, signedIn())).toContain(
      'href="http://localhost:5174/upload"'
    );
  });
});
