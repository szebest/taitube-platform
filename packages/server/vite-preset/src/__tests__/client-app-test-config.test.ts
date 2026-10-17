import { clientAppTestConfig } from '../client-app-test-config';

const viteConfig = async () => ({ resolve: { alias: [{ find: '#app', replacement: '/src' }] } });

const DOM_SPECS = 'src/**/__tests__/**/*.dom.test.{ts,tsx}';

describe('@vp/vite-preset: client app test config', () => {
  it.each([
    {
      environment: 'node' as const,
      project: {
        name: 'studio',
        isolate: false,
        include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
        exclude: ['**/node_modules/**', DOM_SPECS],
        setupFiles: [
          'src/__tests__/own.setup.ts',
          '@vp/web-testing/server-functions.setup',
          '@vp/web-testing/api-server.setup',
        ],
      },
    },
    {
      environment: 'jsdom' as const,
      project: {
        name: 'studio (jsdom)',
        isolate: true,
        include: [DOM_SPECS],
        setupFiles: [
          'src/__tests__/own.setup.ts',
          '@testing-library/jest-dom/vitest',
          '@vp/web-testing/jsdom.setup',
          '@vp/web-testing/api-server.setup',
        ],
      },
    },
  ])(
    'builds the $environment project with its specs, isolation and setup files',
    async ({ environment, project }) => {
      const config = await clientAppTestConfig(viteConfig, {
        app: 'studio',
        environment,
        setupFiles: ['src/__tests__/own.setup.ts'],
      });

      expect(config.test).toMatchObject({ environment, ...project });
      expect(config.resolve?.alias).toEqual([{ find: '#app', replacement: '/src' }]);
    }
  );

  it('leaves the jsdom project on the default exclusions, so a dom spec anywhere under src runs', async () => {
    const { test } = await clientAppTestConfig(viteConfig, { app: 'web', environment: 'jsdom' });

    expect(test?.exclude).toBeUndefined();
  });

  it('restores stubbed globals and environment after every test, in a shared worker pool', async () => {
    const { test } = await clientAppTestConfig(viteConfig, { app: 'web', environment: 'node' });

    expect(test).toMatchObject({
      pool: 'threads',
      globals: true,
      restoreMocks: true,
      unstubEnvs: true,
      unstubGlobals: true,
    });
  });
});
