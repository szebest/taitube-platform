import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { clientAppConfig } from '@kit/vite-preset';
import { serverBundleViolations } from '@kit/vite-preset/bundle-guard';
import { reactPlugins } from '@kit/vite-preset/react-plugins';

const require = createRequire(import.meta.url);
const chunk = (moduleIds: readonly string[]) => ({
  fileName: 'assets/shop.js',
  isEntry: true,
  moduleIds,
  imports: [],
  code: 'export {}',
});

describe('quill shop on its build tooling', () => {
  it('extends the platform tsconfig for its own sources', () => {
    const own = JSON.parse(readFileSync('tsconfig.json', 'utf8'));
    const shared = JSON.parse(readFileSync(require.resolve('@kit/tsconfig/client.json'), 'utf8'));

    expect(own.extends).toBe('@kit/tsconfig/client.json');
    expect(shared.compilerOptions).toMatchObject({ target: 'ES2024' });
  });

  it('keeps its demo pages out of the production server bundle', () => {
    const rules = { flaggedDirs: [{ dir: 'src/demo', env: 'QUILL_DEMO', enabled: false }] };

    expect(serverBundleViolations([chunk(['/quill/src/demo/stock.ts'])], rules)).toEqual([
      'assets/shop.js carries src/demo/, which only a build with QUILL_DEMO=true may ship',
    ]);
    expect(serverBundleViolations([chunk(['/quill/src/shelf/shelf.ts'])], rules)).toEqual([]);
  });

  it('configures its build from the preset with its own port and packages directory', async () => {
    const packagesDir = fileURLToPath(new URL('../../packages', import.meta.url));
    const config = await clientAppConfig({
      configUrl: new URL('../../vite.config.ts', import.meta.url).href,
      port: 5190,
      packagesDir,
    })({ command: 'serve', mode: 'test' });

    expect(config.server).toEqual({ port: 5190, strictPort: true });
    expect(config.resolve?.alias).toEqual([]);
    expect(config.environments?.client?.optimizeDeps?.entries).toContain(
      `${packagesDir}/platform/client/*/src/**/*.{ts,tsx}`
    );
  });

  it.each([
    { compiler: undefined, present: 'vite:react-compiler', absent: '@rolldown/plugin-babel' },
    { compiler: 'oxc' as const, present: 'vite:react-compiler', absent: '@rolldown/plugin-babel' },
    { compiler: 'babel' as const, present: '@rolldown/plugin-babel', absent: 'vite:react-compiler' },
    { compiler: false as const, present: 'vite:react-babel', absent: 'vite:react-compiler' },
  ])(
    'builds the React plugins for the $compiler compiler',
    async ({ compiler, present, absent }) => {
      const plugins = await Promise.all(reactPlugins(compiler));
      const names = plugins.flat(2).map((plugin) => (plugin && 'name' in plugin ? plugin.name : ''));

      expect(names).toContain(present);
      expect(names).not.toContain(absent);
    }
  );
});
