import { AppEnvSchema } from '../../packages/server/env-schema/src/index';
import { pendingPlatformMoves } from '../../scripts/check-boundaries';
import { isPlatform, load, type Pkg } from '../../scripts/workspace-packages';
import { moduleSpecifiers, platformSources, stringTexts } from './platform-sources';
import { read } from './repo-files';

const PRODUCT_NAME = /taitube|video-pipeline|vp-dev|(?<![a-z0-9])vp[._]/i;
const ROUTE = /^\/[a-z][\w:{}.~-]*(?:\/[\w:{}.~-]*)*$/i;
const OTLP_SPEC_PATH = '/v1/traces';
const ENV_KEYS: ReadonlySet<string> = new Set(Object.keys(AppEnvSchema.shape));

function packageName(specifier: string): string {
  return specifier.split('/', specifier.startsWith('@') ? 2 : 1).join('/');
}

function appImports(
  source: string,
  packages: readonly Pkg[],
  pending: ReadonlySet<string>
): string[] {
  const byName = new Map(packages.map((pkg) => [pkg.name, pkg]));
  return moduleSpecifiers(source).filter((specifier) => {
    const name = packageName(specifier);
    const target = byName.get(name);
    if (target) return !(isPlatform(target.dir) || pending.has(name));
    return name.startsWith('@vp/');
  });
}

function appData(file: string, source: string): string[] {
  return stringTexts(file, source).flatMap((text) => {
    if (PRODUCT_NAME.test(text)) return [`${file}: names the product: ${text}`];
    if (ENV_KEYS.has(text)) return [`${file}: names the app env key ${text}`];
    if (text !== OTLP_SPEC_PATH && ROUTE.test(text)) return [`${file}: holds the route ${text}`];
    return [];
  });
}

const PACKAGES: Pkg[] = [
  { name: '@vp/domain', dir: 'packages/universal/domain', layer: 2, deps: [] },
  { name: '@vp/web', dir: 'apps/client/web', layer: 6, deps: [] },
  { name: '@kit/result', dir: 'packages/platform/universal/result', layer: 1, deps: [] },
  { name: '@kit/di', dir: 'packages/platform/universal/di', layer: 2, deps: [] },
];
const PENDING = new Set(['@kit/result']);

describe('architecture: platform packages hold no app data', () => {
  it.each([
    { shape: 'the product name', source: "export const realm = 'taitube';" },
    { shape: 'a repository name', source: 'export const repo = `video-pipeline/${x}`;' },
    { shape: 'a dev issuer', source: "export const issuer = 'vp-dev';" },
    { shape: 'a dotted prefix', source: "export const cookie = 'vp.session';" },
    { shape: 'an underscored prefix', source: "export const metric = 'vp_requests_total';" },
    {
      shape: 'the product name in JSX text',
      source: 'export const a = <p>Welcome to Taitube</p>;',
    },
    { shape: 'an app env key', source: "export const key = 'DATABASE_URL';" },
    { shape: 'another /v1 route', source: "export const path = '/v1/metrics';" },
    { shape: 'a route', source: "export const path = '/v1/categories';" },
    { shape: 'a route with a parameter', source: "export const path = '/videos/:id/comments';" },
  ])('recognises $shape', ({ source }) => {
    expect(appData('fixture.tsx', source)).toHaveLength(1);
  });

  it.each([
    { shape: 'a word that merely ends in vp', source: "export const a = 'rsvp.yes';" },
    { shape: 'a plain token', source: "export const a = 'default';" },
    { shape: 'a sentence with a slash', source: "export const a = 'on/off';" },
    { shape: 'a scoped specifier', source: "import type { Result } from '@kit/result';" },
    {
      shape: 'the OpenTelemetry traces path',
      source: 'export const url = `${endpoint}/v1/traces`;',
    },
    { shape: 'a bare slash', source: "export const root = '/';" },
  ])('leaves $shape alone', ({ source }) => {
    expect(appData('fixture.ts', source)).toEqual([]);
  });

  it.each([
    { shape: 'an app-side package', source: "import { x } from '@vp/domain';", found: 1 },
    { shape: 'an app', source: "export * from '@vp/web/routes';", found: 1 },
    {
      shape: 'a dynamic import of an app package',
      source: "await import('@vp/domain/x');",
      found: 1,
    },
    { shape: 'an unknown @vp package', source: "import 'node:fs'; import '@vp/ghost';", found: 1 },
    { shape: 'a platform package', source: "import { x } from '@kit/di';", found: 0 },
    { shape: 'a third-party package', source: "import { z } from 'zod';", found: 0 },
    {
      shape: 'a package whose move to @kit/* is pending',
      source: "import '@kit/result';",
      found: 0,
    },
  ])('counts $found app import(s) in $shape', ({ source, found }) => {
    expect(appImports(source, PACKAGES, PENDING)).toHaveLength(found);
  });

  it('finds none in platform source', () => {
    const packages = load();
    const sources = platformSources();

    expect(sources.length).toBeGreaterThan(0);
    expect(
      sources.flatMap((file) => [
        ...appData(file, read(file)),
        ...appImports(read(file), packages, pendingPlatformMoves()).map(
          (specifier) => `${file}: imports ${specifier}`
        ),
      ])
    ).toEqual([]);
  });
});
