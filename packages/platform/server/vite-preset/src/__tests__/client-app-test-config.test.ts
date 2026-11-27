import { clientAppTestConfig } from '../client-app-test-config';

const viteConfig = async () => ({ resolve: { alias: [{ find: '#app', replacement: '/src' }] } });

const DOM_SPECS = 'src/**/__tests__/**/*.dom.test.{ts,tsx}';
const SETUP_FILES = ['src/__tests__/own.setup.ts', 'shared/spec.setup'];
const ENV = { FLAG: 'true' };

describe('@kit/vite-preset: client app test config', () => {
  it.each([
    {
      environment: 'node' as const,
      project: {
        name: 'studio',
        isolate: false,
        include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
        exclude: ['**/node_modules/**', DOM_SPECS],
        setupFiles: SETUP_FILES,
        env: ENV,
      },
    },
    {
      environment: 'jsdom' as const,
      project: {
        name: 'studio (jsdom)',
        isolate: true,
        include: [DOM_SPECS],
        setupFiles: SETUP_FILES,
        env: { ...ENV, RTL_SKIP_AUTO_CLEANUP: 'true' },
      },
    },
  ])(
    'builds the $environment project with its specs, isolation, setup files and environment',
    async ({ environment, project }) => {
      const config = await clientAppTestConfig(viteConfig, {
        app: 'studio',
        environment,
        setupFiles: SETUP_FILES,
        env: ENV,
      });

      expect(config.test).toMatchObject({ environment, ...project });
      expect(config.resolve?.alias).toEqual([{ find: '#app', replacement: '/src' }]);
    }
  );

  it('leaves the jsdom project on the default exclusions, so a dom spec anywhere under src runs', async () => {
    const { test } = await clientAppTestConfig(viteConfig, {
      app: 'web',
      environment: 'jsdom',
      setupFiles: SETUP_FILES,
    });

    expect(test?.exclude).toBeUndefined();
  });

  it('builds the uncompiled project over the given specs with the React plugin alone', async () => {
    const compiledApp = async () => ({ plugins: [{ name: 'vite:react-compiler' }] });
    const config = await clientAppTestConfig(compiledApp, {
      app: 'studio',
      environment: 'jsdom',
      setupFiles: SETUP_FILES,
      compiler: false,
      include: ['src/**/__tests__/**/*.differential.dom.test.tsx'],
    });

    expect(config.test).toMatchObject({
      name: 'studio (jsdom, uncompiled)',
      include: ['src/**/__tests__/**/*.differential.dom.test.tsx'],
    });
    expect(config.plugins?.flat()).not.toContainEqual(
      expect.objectContaining({ name: 'vite:react-compiler' })
    );
  });

  it('restores stubbed globals and environment after every test, in a shared worker pool', async () => {
    const { test } = await clientAppTestConfig(viteConfig, {
      app: 'web',
      environment: 'node',
      setupFiles: SETUP_FILES,
    });

    expect(test).toMatchObject({
      pool: 'threads',
      globals: true,
      restoreMocks: true,
      unstubEnvs: true,
      unstubGlobals: true,
    });
  });
});
