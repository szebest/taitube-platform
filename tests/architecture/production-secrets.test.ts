import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { loadAll } from 'js-yaml';
import {
  AppEnvSchema,
  SECRET_KEYS,
  heldLocalCredentials,
} from '../../packages/server/env-schema/src/index';
import { ROOT } from './repo-files';

interface Manifest {
  kind: string;
  metadata: { name: string };
  data?: Record<string, string>;
  stringData?: Record<string, string>;
  spec?: { data?: { secretKey: string }[] };
}

function render(overlay: string): Manifest[] {
  const output = execFileSync('kustomize', ['build', join(ROOT, overlay)], { encoding: 'utf8' });
  return loadAll(output) as Manifest[];
}

function named(manifests: Manifest[], kind: string, name: string): Manifest | undefined {
  return manifests.find((manifest) => manifest.kind === kind && manifest.metadata.name === name);
}

/** What `envFrom` hands an app pod: the ConfigMap's data, then the Secret's. */
function podEnv(manifests: Manifest[]): Record<string, string> {
  const secret = named(manifests, 'Secret', 'vp-secrets');
  const decoded = Object.fromEntries(
    Object.entries(secret?.data ?? {}).map(([key, value]) => [
      key,
      Buffer.from(value, 'base64').toString('utf8'),
    ])
  );
  return {
    ...named(manifests, 'ConfigMap', 'vp-config')?.data,
    ...decoded,
    ...secret?.stringData,
  };
}

function refusedKeys(env: Record<string, string>): string[] {
  const parsed = AppEnvSchema.safeParse(env);
  return [...new Set((parsed.error?.issues ?? []).map((issue) => issue.path.join('.')))].sort();
}

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(strings);
  return [];
}

describe('architecture: rendered production manifests carry no local credential', () => {
  it('has a kustomize binary to render with', () => {
    expect(execFileSync('kustomize', ['version'], { encoding: 'utf8' })).toMatch(/v5\./);
  });

  it('refuses the base under production until every secret is overridden', () => {
    const base = podEnv(render('infra/k8s/base'));

    expect(base['NODE_ENV']).toBe('production');
    expect(refusedKeys(base)).toEqual(
      expect.arrayContaining([...SECRET_KEYS, 'AUTH_JWKS_URL'].sort())
    );

    const rotated = Object.fromEntries(
      SECRET_KEYS.map((key) => [
        key,
        key === 'DATABASE_URL' ? 'postgres://app:rotated@db:5432/vp' : `${key}-rotated`,
      ])
    );
    expect(
      refusedKeys({
        ...base,
        ...rotated,
        AUTH_JWKS_URL: 'https://idp.vp.local/.well-known/jwks.json',
      })
    ).toEqual([]);
  });

  it('renders the cloud overlay with no Secret value at all', () => {
    const secrets = render('infra/k8s/overlays/cloud').filter(
      (manifest) => manifest.kind === 'Secret' && (manifest.data || manifest.stringData)
    );

    expect(secrets).toEqual([]);
  });

  it('declares one ExternalSecret entry for every secret the schema requires', () => {
    const external = named(render('infra/k8s/overlays/cloud'), 'ExternalSecret', 'vp-secrets');
    const keys = (external?.spec?.data ?? []).map((entry) => entry.secretKey);

    for (const key of SECRET_KEYS) {
      expect(keys.filter((candidate) => candidate === key)).toEqual([key]);
    }
  });

  it('gives every cloud key one owner: the ConfigMap or the ExternalSecret, never both', () => {
    const cloud = render('infra/k8s/overlays/cloud');
    const configMapKeys = Object.keys(named(cloud, 'ConfigMap', 'vp-config')?.data ?? {});
    const secretKeys = new Set(
      (named(cloud, 'ExternalSecret', 'vp-secrets')?.spec?.data ?? []).map(
        (entry) => entry.secretKey
      )
    );

    expect(configMapKeys.filter((key) => secretKeys.has(key))).toEqual([]);
  });

  it('renders no credential the repo ships for local use into the cloud overlay', () => {
    const leaked = strings(render('infra/k8s/overlays/cloud')).filter(heldLocalCredentials);

    expect(leaked).toEqual([]);
  });

  it('recognises a local credential rendered into a manifest', () => {
    const manifest = { kind: 'Secret', stringData: { REDIS_URL: 'redis://:vp@redis:6379/0' } };

    expect(strings(manifest).filter(heldLocalCredentials)).toEqual(['redis://:vp@redis:6379/0']);
  });
});
