import { execFileSync, execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as yaml from 'js-yaml';

export interface Container {
  image: string;
  command: string[];
  securityContext: { readOnlyRootFilesystem: boolean; allowPrivilegeEscalation: boolean };
  resources: { requests: Record<string, string>; limits: Record<string, string> };
  livenessProbe: { httpGet?: { path: string }; exec: { command: string[] } };
  readinessProbe: { httpGet: { path: string; port?: string } };
  env: { name: string; valueFrom?: { resourceFieldRef?: { resource: string } } }[];
}

interface PodSpec {
  securityContext: { runAsNonRoot: boolean; runAsUser: number };
  terminationGracePeriodSeconds: number;
  containers: Container[];
  volumes: { name: string; emptyDir?: { sizeLimit?: string } }[];
}

export interface Trigger {
  type: string;
  metadata: Record<string, string>;
}

interface ScalingPolicy {
  stabilizationWindowSeconds: number;
}

export interface Manifest {
  kind: string;
  metadata?: { name?: string; namespace?: string };
  data: Record<string, string>;
  spec: {
    replicas: number;
    template: { spec: PodSpec };
    scaleTargetRef: { name: string };
    minReplicas: number;
    minReplicaCount: number;
    maxReplicaCount: number;
    pollingInterval: number;
    cooldownPeriod: number;
    advanced?: {
      horizontalPodAutoscalerConfig?: {
        behavior?: { scaleUp: ScalingPolicy; scaleDown: ScalingPolicy };
      };
    };
    triggers: Trigger[];
    rules: { http: { paths: { path: string }[] } }[];
    volumeClaimTemplates: { metadata: { name: string } }[];
  };
}

export type Overlay = 'local' | 'cloud';

const repoRoot = path.resolve(__dirname, '../../../../../');
const rendered = new Map<Overlay, Manifest[]>();

export function overlay(name: Overlay): Manifest[] {
  const cached = rendered.get(name);
  if (cached) {
    return cached;
  }
  const dir = path.join(repoRoot, `infra/k8s/overlays/${name}`);
  const documents = yaml.loadAll(
    execSync(`kubectl kustomize "${dir}"`, { encoding: 'utf-8' })
  ) as Manifest[];
  rendered.set(name, documents);
  return documents;
}

export function ofKind(name: Overlay, kind: string): Manifest[] {
  return overlay(name).filter((doc) => doc?.kind === kind);
}

export function named(name: Overlay, kind: string, metadataName: string): Manifest | undefined {
  return ofKind(name, kind).find((doc) => doc.metadata?.name === metadataName);
}

export function containerOf(doc: Manifest | undefined): Container {
  const container = doc?.spec.template.spec.containers[0];
  if (!container) throw new Error(`${doc?.metadata?.name} has no container`);
  return container;
}

export const scaledObjectOf = (name: Overlay, workerName: string) =>
  named(name, 'ScaledObject', `${workerName}-scaledobject`);

export const WORKER_STAGES = [
  {
    name: 'vp-worker-probe',
    grace: 60,
    requests: { cpu: '500m', memory: '512Mi' },
    limits: { cpu: '1000m', memory: '1Gi' },
    threads: true,
    maxReplicas: 4,
    redisFallback: false,
  },
  {
    name: 'vp-worker-transcode-1080p',
    grace: 900,
    requests: { cpu: '1500m', memory: '1.5Gi' },
    limits: { cpu: '2', memory: '2Gi' },
    threads: true,
    maxReplicas: 6,
    redisFallback: false,
  },
  {
    name: 'vp-worker-transcode-720p',
    grace: 600,
    requests: { cpu: '1000m', memory: '1Gi' },
    limits: { cpu: '2', memory: '1.5Gi' },
    threads: true,
    maxReplicas: 6,
    redisFallback: false,
  },
  {
    name: 'vp-worker-transcode-480p',
    grace: 300,
    requests: { cpu: '500m', memory: '512Mi' },
    limits: { cpu: '1', memory: '1Gi' },
    threads: true,
    maxReplicas: 6,
    redisFallback: true,
  },
  {
    name: 'vp-worker-thumbnail',
    grace: 120,
    requests: { cpu: '500m', memory: '512Mi' },
    limits: { cpu: '1000m', memory: '1Gi' },
    threads: true,
    maxReplicas: 4,
    redisFallback: false,
  },
  {
    name: 'vp-worker-package',
    grace: 120,
    requests: { cpu: '500m', memory: '512Mi' },
    limits: { cpu: '1000m', memory: '1Gi' },
    threads: true,
    maxReplicas: 4,
    redisFallback: false,
  },
  {
    name: 'vp-worker-notify',
    grace: 30,
    requests: { cpu: '100m', memory: '128Mi' },
    limits: { cpu: '500m', memory: '256Mi' },
    threads: false,
    maxReplicas: 4,
    redisFallback: false,
  },
  {
    name: 'vp-worker-housekeeping',
    grace: 60,
    requests: { cpu: '200m', memory: '256Mi' },
    limits: { cpu: '500m', memory: '512Mi' },
    threads: false,
    maxReplicas: 2,
    redisFallback: false,
  },
];

export const stage = (name: string) => name.replace('vp-worker-', '');

/** Three heartbeat intervals: the worker writes one every `WORKER_HEARTBEAT_INTERVAL_MS` (15 s). */
export const STALE_AFTER_SECONDS = 45;

/** Runs a liveness command against a heartbeat file of the given age, or none at all. */
export function livenessPasses(command: string, ageSeconds: number | undefined): boolean {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-liveness-'));
  const file = path.join(dir, 'heartbeat');
  if (ageSeconds !== undefined) {
    fs.writeFileSync(file, `${Math.floor(Date.now() / 1000) - ageSeconds}\n`);
  }
  const exits = (() => {
    try {
      execFileSync('sh', ['-c', command.replaceAll('/tmp/vp/heartbeat', file)], {
        stdio: 'ignore',
      });
      return true;
    } catch {
      return false;
    }
  })();
  fs.rmSync(dir, { recursive: true, force: true });
  return exits;
}
