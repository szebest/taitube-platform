import { load } from 'js-yaml';
import { read } from './repo-files';

const COMPOSE = 'infra/compose/docker-compose.yml';
const HELM_VALUES = 'infra/k8s/helm-values/minio.yaml';
const CORS_KEY = 'MINIO_API_CORS_ALLOW_ORIGIN';

interface Compose {
  services: { minio: { environment: Record<string, string> } };
}

interface Values {
  environment: Record<string, string>;
}

describe('architecture: the local object store answers the browser fetches of saved videos', () => {
  it.each([
    {
      where: COMPOSE,
      environment: () => (load(read(COMPOSE)) as Compose).services.minio.environment,
    },
    { where: HELM_VALUES, environment: () => (load(read(HELM_VALUES)) as Values).environment },
  ])('$where sets an explicit CORS origin on MinIO', ({ environment }) => {
    expect(environment()[CORS_KEY]).toBe('*');
  });
});
