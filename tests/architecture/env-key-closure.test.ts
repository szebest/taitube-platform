import {
  composeAppKeys,
  envReads,
  exampleKeys,
  k8sAppKeys,
  makefileAppKeys,
  schemaKeys,
  workflowAppKeys,
} from './env-keys';
import { productionSources, read, trackedFiles } from './repo-files';

interface Manifest {
  name: string;
  dependencies?: Record<string, string>;
}

/** The workspace packages the two deployables load at runtime, dev-only edges excluded. */
function deployableRoots(): string[] {
  const manifests = new Map(
    trackedFiles('apps', 'packages')
      .filter((file) => /^(apps|packages\/\w+)\/[\w-]+\/package\.json$/.test(file))
      .map((file) => [JSON.parse(read(file)).name as string, file.replace('package.json', '')])
  );
  const seen = new Set(['@vp/api', '@vp/worker']);
  const queue = [...seen];
  while (queue.length > 0) {
    const dir = manifests.get(queue.shift() as string) as string;
    const { dependencies = {} } = JSON.parse(read(`${dir}package.json`)) as Manifest;
    for (const name of Object.keys(dependencies).filter((dep) => manifests.has(dep))) {
      if (seen.has(name)) continue;
      seen.add(name);
      queue.push(name);
    }
  }
  return [...seen].map((name) => manifests.get(name) as string);
}

function undeclared(keys: string[]): string[] {
  const declared = schemaKeys();
  return [...new Set(keys)].filter((key) => !declared.has(key)).sort();
}

describe('architecture: the environment schema is closed over what the platform reads and sets', () => {
  it('recognises an undeclared read in source and in an app env block', () => {
    expect(
      undeclared(envReads("const bucket = process.env['STORAGE_RAW_BUCKET'] ?? 'raw';"))
    ).toEqual(['STORAGE_RAW_BUCKET']);
    expect(
      undeclared(
        composeAppKeys(
          'services:\n  api:\n    build:\n      dockerfile: apps/api/Dockerfile\n    environment:\n      STORAGE_RAW_BUCKET: raw\n'
        )
      )
    ).toEqual(['STORAGE_RAW_BUCKET']);
  });

  it('recognises an undeclared key in a manifest, a CI step and a Makefile recipe', () => {
    expect(undeclared(k8sAppKeys('data:\n  STORAGE_RAW_BUCKET: "raw"\n'))).toEqual([
      'STORAGE_RAW_BUCKET',
    ]);
    expect(
      undeclared(
        workflowAppKeys(
          '      - name: t\n        env:\n          S3_RAW_BUCKET: raw\n        run: pnpm test\n'
        )
      )
    ).toEqual(['S3_RAW_BUCKET']);
    expect(undeclared(makefileAppKeys('smoke:\n\tPOSTGRES_URL=x pnpm test\n'))).toEqual([
      'POSTGRES_URL',
    ]);
  });

  it('declares every key the deployables read', () => {
    const roots = deployableRoots();
    const reads = productionSources()
      .filter((file) => roots.some((root) => file.startsWith(root)))
      .flatMap((file) => envReads(read(file)));

    expect(undeclared(reads)).toEqual([]);
  });

  it('mirrors every declared key, uncommented, in .env.example', () => {
    const example = exampleKeys();

    expect([...schemaKeys()].filter((key) => !example.has(key))).toEqual([]);
  });

  it('declares every key compose, k8s, CI and make hand to this code', () => {
    const set = [
      ...composeAppKeys(read('infra/compose/docker-compose.yml')),
      ...trackedFiles('infra/k8s/base')
        .filter((file) => file.endsWith('.yaml'))
        .flatMap((file) => k8sAppKeys(read(file))),
      ...trackedFiles('.github/workflows').flatMap((file) => workflowAppKeys(read(file))),
      ...makefileAppKeys(read('Makefile')),
    ];

    expect(undeclared(set)).toEqual([]);
  });
});
