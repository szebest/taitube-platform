import { securityHeadersMiddleware } from '@vp/security-headers';

import { startInstance } from '../start';

describe('apps/client/web: start', () => {
  it('runs the security headers middleware on every request', async () => {
    const { requestMiddleware = [] } = await startInstance.getOptions();

    expect(requestMiddleware).toContain(securityHeadersMiddleware);
  });
});
