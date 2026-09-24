import { load } from 'js-yaml';
import { read, trackedFiles } from './repo-files';

interface ComposeFile {
  services?: Record<string, { image?: string }>;
}

interface ChartImage {
  repository?: string;
  tag?: string;
}

interface MinioValues {
  image?: ChartImage;
  mcImage?: ChartImage;
}

const HELM_VALUES = 'infra/k8s/helm-values/minio.yaml';

function unpinnedComposeImages(file: string, source: string): string[] {
  const { services = {} } = (load(source) ?? {}) as ComposeFile;
  return Object.entries(services)
    .filter(
      ([, service]) => service.image?.includes('minio') && !service.image.includes('@sha256:')
    )
    .map(([name, service]) => `${file}: ${name} runs ${service.image}`);
}

function unpinnedChartImages(file: string, source: string): string[] {
  const values = (load(source) ?? {}) as MinioValues;
  return Object.entries({ image: values.image, mcImage: values.mcImage })
    .filter(([, image]) => !image?.tag?.includes('@sha256:'))
    .map(([key, image]) => `${file}: ${key} is ${image?.repository}:${image?.tag}`);
}

describe('architecture: every MinIO image is pinned by digest', () => {
  it('fires on a quoted image and on one with a trailing comment', () => {
    const compose = [
      'services:',
      '  minio:',
      '    image: "cgr.dev/chainguard/minio:latest"',
      '  minio-init:',
      '    image: cgr.dev/chainguard/minio-client:latest-dev # init',
    ].join('\n');

    expect(unpinnedComposeImages('compose.yml', compose)).toEqual([
      'compose.yml: minio runs cgr.dev/chainguard/minio:latest',
      'compose.yml: minio-init runs cgr.dev/chainguard/minio-client:latest-dev',
    ]);
  });

  it('fires on a chart tag without a digest, and on a chart image left to its default', () => {
    const values = [
      'image:',
      '  repository: cgr.dev/chainguard/minio',
      '  tag: "latest-dev" # dev',
    ].join('\n');

    expect(unpinnedChartImages('values.yaml', values)).toEqual([
      'values.yaml: image is cgr.dev/chainguard/minio:latest-dev',
      'values.yaml: mcImage is undefined:undefined',
    ]);
  });

  it('finds every compose file and the chart values pinned', () => {
    const composeFiles = trackedFiles(':(glob)infra/compose/docker-compose*.yml');

    expect(composeFiles.length).toBeGreaterThan(1);
    expect([
      ...composeFiles.flatMap((file) => unpinnedComposeImages(file, read(file))),
      ...unpinnedChartImages(HELM_VALUES, read(HELM_VALUES)),
    ]).toEqual([]);
  });
});
