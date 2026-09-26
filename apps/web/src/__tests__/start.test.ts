import { startInstance } from '../start';

describe('apps/web: start', () => {
  it('runs the CSRF check on server functions and the security headers on every request', async () => {
    const { requestMiddleware = [] } = await startInstance.getOptions();

    expect(requestMiddleware.map(({ options }) => typeof options.server)).toEqual([
      'function',
      'function',
    ]);
  });
});
