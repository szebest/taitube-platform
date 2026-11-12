import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { loadAll } from 'js-yaml';
import {
  type Environment,
  EnvironmentSpec,
  isKubernetes,
  type KubernetesEnvironment,
  WORKER_STAGES,
} from '../../packages/server/deploy/src/environment-spec';
import { loadEnvironments } from '../../packages/server/deploy/src/load-environments';
import { parseEnvironment } from '../../packages/server/deploy/src/parse-environment';
import { renderOverlay } from '../../packages/server/deploy/src/render-overlay';
import {
  consistencyFindings,
  type KeyDocs,
  requiredKeys,
} from '../../packages/server/deploy/src/required-keys';
import {
  AppEnvSchema,
  ENV_DOCS,
  EXTRA_ENV_DOCS,
  heldLocalCredentials,
} from '../../packages/server/env-schema/src/index';
import { ROOT, read, trackedFiles } from './repo-files';

interface Manifest {
  kind: string;
  metadata: { name: string; namespace?: string };
  data?: Record<string, string>;
  stringData?: Record<string, string>;
  spec?: {
    data?: { secretKey: string }[];
    maxReplicaCount?: number;
    scaleTargetRef?: { name: string };
  };
}

const run = promisify(execFile);
const DOCS: KeyDocs = { ...EXTRA_ENV_DOCS, ...ENV_DOCS };
const ENVIRONMENT_FILE = (name: string) => `infra/environments/${name}/environment.yaml`;
const NOW = new Date('2026-01-01T00:00:00.000Z');

const loaded = loadEnvironments(ROOT);
const kubernetes = loaded.environments.filter(isKubernetes);

/** One `kustomize build` per cluster environment, started together: they are most of what this file costs. */
async function build(env: KubernetesEnvironment): Promise<Manifest[]> {
  const overlay = renderOverlay(env, {
    namespace: env.cluster.namespace.replace('{slug}', 'architecture'),
    tag: 'architecture',
    now: NOW,
  });
  await mkdir(join(ROOT, overlay.dir), { recursive: true });
  await Promise.all(
    Object.entries(overlay.files).map(([file, text]) =>
      writeFile(join(ROOT, overlay.dir, file), text)
    )
  );
  const { stdout } = await run('kustomize', ['build', join(ROOT, overlay.dir)], {
    encoding: 'utf8',
  });
  return loadAll(stdout) as Manifest[];
}

const rendered = new Map(
  await Promise.all(kubernetes.map(async (env) => [env.name, await build(env)] as const))
);

function podEnv(manifests: Manifest[]): Record<string, string> {
  const config = manifests.find((m) => m.kind === 'ConfigMap' && m.metadata.name === 'vp-config');
  const secret = manifests.find((m) => m.kind === 'Secret' && m.metadata.name === 'vp-secrets');
  return { ...config?.data, ...secret?.stringData };
}

function environmentNamed(name: string): Environment {
  const env = loaded.environments.find((candidate) => candidate.name === name);
  if (env === undefined) throw new Error(`${ENVIRONMENT_FILE(name)} is missing`);
  return env;
}

describe('architecture: every environment under infra/environments is valid and deployable', () => {
  it('has the five environments the deploy docs name, and every file parses', () => {
    expect(loaded.problems).toEqual([]);
    expect(loaded.environments.map((env) => env.name).sort()).toEqual([
      'compose-vm',
      'local',
      'preview',
      'production',
      'staging',
    ]);
  });

  it('lists in each production-mode environment every key a production boot requires', () => {
    const findings = loaded.environments
      .filter((env) => env.production)
      .flatMap((env) => consistencyFindings(env, DOCS, ENVIRONMENT_FILE(env.name)));

    expect(findings).toEqual([]);
  });

  it('names the file to edit when a new production-required key is not listed', () => {
    const docs: KeyDocs = {
      ...DOCS,
      NEW_PRODUCTION_KEY: { visibility: 'secret', requiredIn: ['production'] },
    };

    expect(
      consistencyFindings(environmentNamed('production'), docs, ENVIRONMENT_FILE('production'))
    ).toEqual([
      `production: NEW_PRODUCTION_KEY is a secret a production boot requires: add it to secrets.keys in ${ENVIRONMENT_FILE('production')}`,
    ]);
  });

  it('has a README beside every environment, and the template explains every field', () => {
    const files = new Set(trackedFiles('infra/environments'));
    const names = [...loaded.environments.map((env) => env.name), '_template'];

    expect(names.filter((name) => !files.has(`infra/environments/${name}/README.md`))).toEqual([]);

    const readme = read('infra/environments/_template/README.md');
    const fields = new Set(EnvironmentSpec.options.flatMap((option) => Object.keys(option.shape)));
    expect([...fields].filter((field) => !readme.includes(`\`${field}`))).toEqual([]);
  });

  it('keeps the template a valid environment once it is given a name', () => {
    const parsed = parseEnvironment(
      'example',
      read('infra/environments/_template/environment.yaml')
    );

    expect(parsed.ok ? [] : parsed.error).toEqual([]);
  });

  it('keeps secrets and rendered overlays out of git', () => {
    expect(read('.gitignore').split('\n')).toEqual(
      expect.arrayContaining(['.secrets/', '.deploy/'])
    );
    expect(trackedFiles('.secrets', '.deploy')).toEqual([]);
  });
});

describe('architecture: every cluster environment renders what its file says', () => {
  it.each(kubernetes.map((env) => ({ name: env.name, env })))(
    'puts every $name object in its namespace and caps the stages it names',
    ({ name, env }) => {
      const manifests = rendered.get(name) ?? [];
      const expected = env.cluster.namespace.replace('{slug}', 'architecture');
      const namespaced = manifests.filter(
        (m) => m.kind !== 'Namespace' && m.metadata.namespace !== undefined
      );

      expect(
        namespaced.filter((m) => m.metadata.namespace !== expected).map((m) => m.kind)
      ).toEqual([]);
      for (const [stage, max] of Object.entries(env.scaling.maxReplicas)) {
        const scaled = manifests.find(
          (m) => m.kind === 'ScaledObject' && m.spec?.scaleTargetRef?.name === `vp-worker-${stage}`
        );
        expect(scaled?.spec?.maxReplicaCount, `${stage} in ${ENVIRONMENT_FILE(name)}`).toBe(max);
      }
      expect(
        Object.keys(env.scaling.maxReplicas).filter((s) => !WORKER_STAGES.includes(s))
      ).toEqual([]);
    }
  );

  it.each(kubernetes.map((env) => ({ name: env.name, env })))(
    'runs the smoke upload against $name only when it runs dev auth outside production',
    ({ name, env }) => {
      const authMode = podEnv(rendered.get(name) ?? [])['AUTH_MODE'];

      if (env.health.smoke) {
        expect(
          { authMode, production: env.production },
          `${ENVIRONMENT_FILE(name)}: scripts/e2e-smoke.sh mints a dev token, so smoke needs AUTH_MODE=dev and production: false`
        ).toEqual({ authMode: 'dev', production: false });
      }
    }
  );

  it.each(kubernetes.filter((env) => env.preview !== undefined).map((env) => ({ name: env.name })))(
    'exposes no Ingress from the $name render, so a shared cluster never serves its dev-auth API on a host',
    ({ name }) => {
      expect((rendered.get(name) ?? []).filter((m) => m.kind === 'Ingress')).toEqual([]);
    }
  );

  it.each(kubernetes.filter((env) => env.production).map((env) => ({ name: env.name, env })))(
    'boots $name under the schema once its secrets are supplied, with no credential rendered',
    ({ name, env }) => {
      const manifests = rendered.get(name) ?? [];
      const supplied = Object.fromEntries(
        requiredKeys(env, DOCS).secrets.map((key) => [
          key,
          key === 'DATABASE_URL' ? 'postgres://app:rotated@db:5432/vp' : `${key}-rotated`,
        ])
      );
      const parsed = AppEnvSchema.safeParse({ ...podEnv(manifests), ...supplied });

      expect(parsed.error?.issues.map((i) => `${i.path.join('.')}: ${i.message}`) ?? []).toEqual(
        []
      );
      expect(manifests.filter((m) => m.kind === 'Secret' && (m.data || m.stringData))).toEqual([]);
      expect(Object.values(podEnv(manifests)).filter(heldLocalCredentials)).toEqual([]);
    }
  );

  it.each(
    kubernetes
      .filter((env) => env.secrets.source === 'external-secrets')
      .map((env) => ({
        name: env.name,
        env,
      }))
  )('lists in $name the exact keys its ExternalSecret materialises', ({ name, env }) => {
    const external = (rendered.get(name) ?? []).find((m) => m.kind === 'ExternalSecret');
    const keys = (external?.spec?.data ?? []).map((entry) => entry.secretKey).sort();

    expect(
      keys,
      `${ENVIRONMENT_FILE(name)} secrets.keys and infra/k8s/overlays/cloud/external-secret.yaml must agree`
    ).toEqual([...env.secrets.keys].sort());
  });
});
