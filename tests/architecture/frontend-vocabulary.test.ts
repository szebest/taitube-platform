import { read, trackedFiles } from './repo-files';
import { workspaceClosure } from './workspace-closure';

/**
 * Vocabulary that only a server has any business knowing. The tier rule stops a browser
 * package *depending* on a server one; it cannot see a server secret sitting inside a
 * universal package that the browser already imports, which is how `transcode-1080p` and
 * `minioadmin` reached `main.*.js`.
 */
const SERVER_VOCABULARY = [
  'S3_SECRET_ACCESS_KEY',
  'ADMIN_TOKEN',
  'WEBHOOK_SIGNING_SECRET',
  'DATABASE_URL',
  'REDIS_URL',
  'BULLMQ_PREFIX',
  'transcode-1080p',
  'minioadmin',
  'postgres://',
  'redis://',
];

const BROWSER_TIERS = ['packages/universal/', 'packages/client/'];

function frontendSources(): string[] {
  const roots = [...workspaceClosure('apps/web', 'runtime'), 'apps/web'];

  return trackedFiles(...roots.map((dir) => `${dir}/src`)).filter(
    (file) => /\.tsx?$/.test(file) && !/\/__(tests|mocks)__\//.test(file)
  );
}

function shipsCode(dir: string): boolean {
  return trackedFiles(`${dir}/src`).length > 0;
}

describe('architecture: frontend vocabulary', () => {
  it('still reads the sources the frontend resolves', () => {
    expect(frontendSources()).toContain('apps/web/src/config/index.ts');
    expect(frontendSources().length).toBeGreaterThan(20);
  });

  it.each(SERVER_VOCABULARY)('never names %s anywhere the browser can reach', (token) => {
    const offenders = frontendSources().filter((file) => read(file).includes(token));

    expect(offenders).toEqual([]);
  });

  it('lets the bundler drop what the browser does not use from every browser-tier package', () => {
    const undeclared = trackedFiles(...BROWSER_TIERS)
      .filter((file) => file.endsWith('/package.json'))
      .filter((file) => shipsCode(file.replace('/package.json', '')))
      .filter((file) => JSON.parse(read(file)).sideEffects !== false);

    expect(undeclared).toEqual([]);
  });
});
