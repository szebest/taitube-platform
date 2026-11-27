import { load } from 'js-yaml';
import { configData, renderOverlay } from '../render-overlay';
import { PREVIEW, PRODUCTION } from './fixtures';

const now = new Date('2026-11-10T12:00:00.000Z');

interface Kustomization {
  namespace: string;
  resources: string[];
  images: { name: string; newName: string; newTag: string }[];
  patches: { target: Record<string, string>; patch: string }[];
}

function kustomization(
  env: Parameters<typeof renderOverlay>[0],
  namespace: string,
  tag = 'v1.2.3'
) {
  const overlay = renderOverlay(env, { namespace, tag, now });
  return { overlay, parsed: load(overlay.files['kustomization.yaml'] ?? '') as Kustomization };
}

describe('configData', () => {
  it('derives origins and the CDN from hosts, flags from features, and lets config win', () => {
    expect(
      configData({
        ...PRODUCTION,
        config: { ...PRODUCTION.config, CDN_BASE_URL: 'https://override.example.org' },
      })
    ).toEqual({
      CORS_ORIGINS: 'https://taitube.example.org',
      CDN_BASE_URL: 'https://override.example.org',
      CAPTIONS_ENABLED: 'true',
      SCREENING_ENABLED: 'false',
      AUTH_JWKS_URL: 'https://auth.example.org/jwks.json',
    });
  });

  it.each([
    { host: 'app.localhost', origin: 'http://app.localhost' },
    { host: 'localhost', origin: 'http://localhost' },
    { host: 'app.example.org', origin: 'https://app.example.org' },
  ])('uses the scheme a browser reaches $host with', ({ host, origin }) => {
    expect(configData({ ...PRODUCTION, hosts: { web: host } })['CORS_ORIGINS']).toBe(origin);
  });

  it('sets no origin when there are no hosts', () => {
    expect(Object.keys(configData(PREVIEW))).not.toContain('CORS_ORIGINS');
  });
});

describe('renderOverlay', () => {
  it('writes the overlay under .deploy, over the environment directory, in the given namespace', () => {
    const { overlay, parsed } = kustomization(PRODUCTION, 'video-pipeline');

    expect(overlay.dir).toBe('.deploy/production');
    expect(parsed.namespace).toBe('video-pipeline');
    expect(parsed.resources).toEqual(['../../infra/environments/production', 'quota.yaml']);
  });

  it('retags the four app images for a registry environment', () => {
    const { parsed } = kustomization(PRODUCTION, 'video-pipeline');

    expect(parsed.images).toEqual(
      ['vp-api', 'vp-worker', 'vp-web', 'vp-studio'].map((image) => ({
        name: `ghcr.io/szebest/${image}`,
        newName: `ghcr.io/acme/${image}`,
        newTag: 'v1.2.3',
      }))
    );
  });

  it('leaves the images to the overlay beneath it for a build environment', () => {
    const { parsed } = kustomization(
      { ...PRODUCTION, images: { source: 'build', registry: 'local', tag: 'local' } },
      'video-pipeline'
    );

    expect(parsed.images).toEqual([]);
  });

  it('caps each stage the environment names and no other', () => {
    const { parsed } = kustomization(PRODUCTION, 'video-pipeline');
    const caps = parsed.patches.filter((patch) => patch.target['kind'] === 'ScaledObject');

    expect(caps.map((cap) => [cap.target['name'], load(cap.patch)])).toEqual([
      [
        'vp-worker-probe-scaledobject',
        [{ op: 'replace', path: '/spec/maxReplicaCount', value: 2 }],
      ],
      [
        'vp-worker-transcode-480p-scaledobject',
        [{ op: 'replace', path: '/spec/maxReplicaCount', value: 3 }],
      ],
    ]);
  });

  it('writes the budget as a ResourceQuota, and none when there is no budget', () => {
    const budgeted = kustomization(PRODUCTION, 'video-pipeline').overlay.files['quota.yaml'];
    const free = kustomization({ ...PRODUCTION, scaling: { maxReplicas: {} } }, 'video-pipeline');

    expect(load(budgeted ?? '')).toMatchObject({
      kind: 'ResourceQuota',
      spec: { hard: { 'requests.cpu': '8', 'requests.memory': '16Gi', pods: '40' } },
    });
    expect(Object.keys(free.overlay.files)).toEqual(['kustomization.yaml']);
    expect(free.parsed.resources).toEqual(['../../infra/environments/production']);
  });

  it('stamps a preview namespace with a label and the time it expires', () => {
    const { parsed } = kustomization(PREVIEW, 'preview-feat-x');
    const patch = parsed.patches.find((candidate) => candidate.target['kind'] === 'Namespace');

    expect(parsed.namespace).toBe('preview-feat-x');
    expect(load(patch?.patch ?? '')).toMatchObject({
      metadata: {
        labels: { 'vp.dev/preview': 'true' },
        annotations: { 'vp.dev/expires-at': '2026-11-11T12:00:00.000Z' },
      },
    });
  });

  it('does not stamp an environment that is not a preview', () => {
    const { parsed } = kustomization(PRODUCTION, 'video-pipeline');

    expect(parsed.patches.some((patch) => patch.target['kind'] === 'Namespace')).toBe(false);
  });
});
