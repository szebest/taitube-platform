import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';

interface Service {
  healthcheck?: { test: string[] };
  '<<'?: Service;
}

const repoRoot = path.resolve(__dirname, '../../../../../');
const compose = yaml.load(
  fs.readFileSync(path.join(repoRoot, 'infra/compose/docker-compose.yml'), 'utf-8')
) as { services: Record<string, Service> };

/** js-yaml keeps `<<: *worker` as a key; Compose merges it, so the spec merges it the same way. */
function service(name: string): Service {
  const declared = compose.services[name] ?? {};
  return { ...declared['<<'], ...declared };
}

const healthcheckOf = (name: string) => service(name).healthcheck?.test.join(' ') ?? '';

const workers = Object.keys(compose.services).filter((name) => name.startsWith('worker-'));

describe('infra/compose: health checks', () => {
  it('reads every worker stage', () => {
    expect(workers).toHaveLength(8);
  });

  it('holds the api healthy only while it is ready, not merely alive', () => {
    expect(healthcheckOf('api')).toContain('http://localhost:3000/readyz');
  });

  it.each(workers)('holds %s healthy on its readiness endpoint', (name) => {
    expect(healthcheckOf(name)).toContain('/readyz');
  });
});
