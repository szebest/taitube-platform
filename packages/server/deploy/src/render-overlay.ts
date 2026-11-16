import { dump } from 'js-yaml';
import { FEATURE_KEYS, type KubernetesEnvironment } from './environment-spec';
import { expiresAt } from './preview';

const BASE_IMAGE_REPOSITORY = 'ghcr.io/szebest';
const APP_IMAGES = ['vp-api', 'vp-worker', 'vp-web', 'vp-studio'] as const;
const RENDER_DIR = '.deploy';

export interface RenderOptions {
  namespace: string;
  tag: string | undefined;
  now: Date;
}

export interface RenderedOverlay {
  dir: string;
  files: Record<string, string>;
}

const yaml = (value: unknown): string => dump(value, { lineWidth: -1, noRefs: true });

function origin(host: string): string {
  const local = host === 'localhost' || host.endsWith('.localhost');
  return `${local ? 'http' : 'https'}://${host}`;
}

/** @internal The ConfigMap entries an environment sets: hosts first, then flags, then its own `config`, which wins. */
export function configData(env: KubernetesEnvironment): Record<string, string> {
  const { web, studio, cdn } = env.hosts;
  const origins = [web, studio].filter((host) => host !== undefined).map(origin);
  const hosts: Record<string, string> = {
    ...(origins.length > 0 ? { CORS_ORIGINS: origins.join(',') } : {}),
    ...(cdn === undefined ? {} : { CDN_BASE_URL: origin(cdn) }),
  };
  const features = Object.fromEntries(
    Object.entries(FEATURE_KEYS).map(([feature, key]) => [
      key,
      String(env.features[feature as keyof typeof FEATURE_KEYS]),
    ])
  );
  return { ...hosts, ...features, ...env.config };
}

function scaledObjectPatches(env: KubernetesEnvironment): unknown[] {
  return Object.entries(env.scaling.maxReplicas)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([stage, max]) => ({
      target: {
        group: 'keda.sh',
        version: 'v1alpha1',
        kind: 'ScaledObject',
        name: `vp-worker-${stage}-scaledobject`,
      },
      patch: yaml([{ op: 'replace', path: '/spec/maxReplicaCount', value: max }]),
    }));
}

function namespacePatch(env: KubernetesEnvironment, options: RenderOptions): unknown[] {
  if (env.preview === undefined) return [];
  return [
    {
      target: { kind: 'Namespace' },
      patch: yaml({
        apiVersion: 'v1',
        kind: 'Namespace',
        metadata: {
          name: 'placeholder',
          labels: { 'vp.dev/preview': 'true' },
          annotations: { 'vp.dev/expires-at': expiresAt(options.now, env.preview.ttlHours) },
        },
      }),
    },
  ];
}

function imageRules(env: KubernetesEnvironment, tag: string | undefined): unknown[] {
  if (env.images.source !== 'registry') return [];
  return APP_IMAGES.map((image) => ({
    name: `${BASE_IMAGE_REPOSITORY}/${image}`,
    newName: `${env.images.registry}/${image}`,
    newTag: tag ?? env.images.tag,
  }));
}

function quota(env: KubernetesEnvironment): string | undefined {
  if (env.scaling.budget === undefined) return undefined;
  const { cpu, memory, pods } = env.scaling.budget;
  return yaml({
    apiVersion: 'v1',
    kind: 'ResourceQuota',
    metadata: { name: 'vp-budget' },
    spec: { hard: { 'requests.cpu': cpu, 'requests.memory': memory, pods: String(pods) } },
  });
}

/** The overlay `deploy` builds: the environment's own kustomization plus what its typed values say. */
export function renderOverlay(env: KubernetesEnvironment, options: RenderOptions): RenderedOverlay {
  const budget = quota(env);
  const kustomization = {
    apiVersion: 'kustomize.config.k8s.io/v1beta1',
    kind: 'Kustomization',
    namespace: options.namespace,
    resources: [
      `../../infra/environments/${env.name}`,
      ...(budget === undefined ? [] : ['quota.yaml']),
    ],
    labels: [{ pairs: { 'vp.dev/environment': env.name }, includeSelectors: false }],
    images: imageRules(env, options.tag),
    patches: [
      {
        target: { kind: 'ConfigMap', name: 'vp-config' },
        patch: yaml({
          apiVersion: 'v1',
          kind: 'ConfigMap',
          metadata: { name: 'vp-config' },
          data: configData(env),
        }),
      },
      ...scaledObjectPatches(env),
      ...namespacePatch(env, options),
    ],
  };
  return {
    dir: `${RENDER_DIR}/${env.name}`,
    files: {
      'kustomization.yaml': yaml(kustomization),
      ...(budget === undefined ? {} : { 'quota.yaml': budget }),
    },
  };
}
