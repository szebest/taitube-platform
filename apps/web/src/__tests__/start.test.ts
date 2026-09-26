import { securityHeadersMiddleware } from '#app/integrations/security/security-headers';
import { startInstance } from '../start';

describe('apps/web: start', () => {
  it('runs the security headers on every request the server answers', async () => {
    const { requestMiddleware } = await startInstance.getOptions();

    expect(requestMiddleware).toContain(securityHeadersMiddleware);
  });
});
