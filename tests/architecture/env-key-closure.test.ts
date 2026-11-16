import {
  AppEnvSchema,
  describeEnvKey,
  ENV_DOCS,
  ENV_GROUPS,
  EXTRA_ENV_DOCS,
  heldLocalCredentials,
  SECRET_KEYS,
} from '../../packages/server/env-schema/src/index';
import { renderFor } from '../../scripts/env-docs/run';
import {
  docFindings,
  lockedValueFindings,
  secretSchemaKeys,
  unknownExampleKeys,
  visibilityFindings,
} from './env-docs-rules';
import {
  composeAppKeys,
  envReads,
  exampleEntries,
  exampleKeys,
  k8sAppKeys,
  makefileAppKeys,
  platformKeys,
  schemaKeys,
  workflowAppKeys,
} from './env-keys';
import { productionSources, ROOT, read, trackedFiles } from './repo-files';

interface Manifest {
  name: string;
  dependencies?: Record<string, string>;
}

/** The workspace packages the two deployables load at runtime, dev-only edges excluded. */
function deployableRoots(): string[] {
  const manifests = new Map(
    trackedFiles('apps', 'packages')
      .filter((file) => /^(apps|packages)\/\w+\/[\w-]+\/package\.json$/.test(file))
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

const SCHEMA_DIR = 'packages/server/env-schema/src';

/**
 * Keys `.env.example` sets on purpose to something other than the schema default, each with why. A key
 * that stops differing must leave this list.
 */
const LOCAL_OVERRIDES: Record<string, string> = {
  WEBHOOK_ALLOW_PRIVATE_HOSTS:
    'local webhook receivers sit on private hosts; production refuses true',
};

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
          'services:\n  api:\n    image: vp-api:local\n    environment:\n      STORAGE_RAW_BUCKET: raw\n'
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
        k8sAppKeys(
          '      - op: add\n        path: /data/HOUSEKEEPING_INTERVAL_MS\n        value: "1"\n'
        )
      )
    ).toEqual(['HOUSEKEEPING_INTERVAL_MS']);
    expect(undeclared(k8sAppKeys('  data:\n    - secretKey: LOKI_URL\n'))).toEqual(['LOKI_URL']);
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

  it('declares every key compose, the k8s base and overlays, CI and make hand to this code', () => {
    const set = [
      ...composeAppKeys(read('infra/compose/docker-compose.yml')),
      ...trackedFiles('infra/k8s/base', 'infra/k8s/overlays')
        .filter((file) => file.endsWith('.yaml'))
        .flatMap((file) => k8sAppKeys(read(file))),
      ...trackedFiles('.github/workflows').flatMap((file) => workflowAppKeys(read(file))),
      ...makefileAppKeys(read('Makefile')),
    ];

    expect(undeclared(set)).toEqual([]);
  });
  it('recognises an empty description, an unknown example key and a secret shown as public', () => {
    const body = { description: ' ', example: 'x', visibility: 'secret', readBy: [] } as const;
    const entries = [
      { key: 'ADMIN_TOKEN', value: 'x', commented: false, secret: true, section: 'Auth' },
      { key: 'MADE_UP', value: '1', commented: false, secret: false, section: 'Core' },
    ];

    expect(docFindings({ ADMIN_TOKEN: body }, 'the registry')).toHaveLength(3);
    expect(unknownExampleKeys(entries, new Set(['ADMIN_TOKEN']))).toHaveLength(1);
    expect(
      visibilityFindings({ ADMIN_TOKEN: { visibility: 'public' } }, ['ADMIN_TOKEN'], entries)
    ).toHaveLength(1);
    expect(lockedValueFindings(entries, () => false)).toHaveLength(1);
  });

  it('documents every schema key with a description, an example, a reader and a safe example', () => {
    expect(docFindings(ENV_DOCS, `${SCHEMA_DIR}/env-docs-*.ts`)).toEqual([]);
  });

  it('documents every key outside the schema, in EXTRA_ENV_DOCS, with the same care', () => {
    const missing = platformKeys().filter((key) => !(key in EXTRA_ENV_DOCS));
    const homeless = Object.keys(EXTRA_ENV_DOCS).filter(
      (key) => !platformKeys().includes(key) && !exampleEntries().some((entry) => entry.key === key)
    );

    expect(
      missing.map(
        (key) =>
          `${key}: add it to EXTRA_ENV_DOCS in ${SCHEMA_DIR}/env-docs-extra.ts, then run pnpm gen:env-docs`
      )
    ).toEqual([]);
    expect(
      homeless.map(
        (key) =>
          `${key} is in EXTRA_ENV_DOCS but in neither platform-env.json nor .env.example: add the line or remove the entry`
      )
    ).toEqual([]);
    expect(docFindings(EXTRA_ENV_DOCS, `${SCHEMA_DIR}/env-docs-extra.ts`)).toEqual([]);
  });

  it('lists in .env.example only keys the schema declares or EXTRA_ENV_DOCS documents', () => {
    const declared = new Set([...Object.keys(AppEnvSchema.shape), ...Object.keys(EXTRA_ENV_DOCS)]);

    expect(unknownExampleKeys(exampleEntries(), declared)).toEqual([]);
  });

  it('parses the live lines of .env.example through the schema', () => {
    const live = Object.fromEntries(
      exampleEntries()
        .filter((entry) => !entry.commented)
        .map((entry) => [entry.key, entry.value])
    );
    const parsed = AppEnvSchema.safeParse(live);

    expect(
      parsed.success
        ? []
        : parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    ).toEqual([]);
  });

  it('sets a key with a default to that default, unless it is a listed local override', () => {
    const live = exampleEntries().filter(
      (entry) => !entry.commented && entry.key in AppEnvSchema.shape
    );
    const keys = live.map((entry) => entry.key as keyof typeof ENV_DOCS);
    const differing = live.filter((entry, at) => {
      const shape = describeEnvKey(keys[at] as keyof typeof ENV_DOCS);
      const parsed = AppEnvSchema.shape[keys[at] as keyof typeof ENV_DOCS].safeParse(entry.value);
      return (
        shape.default.kind === 'value' &&
        parsed.success &&
        !Object.is(String(parsed.data), shape.default.value)
      );
    });

    expect(
      differing
        .filter((entry) => !(entry.key in LOCAL_OVERRIDES))
        .map(
          (entry) =>
            `${entry.key} differs from the schema default: change .env.example, or list it in LOCAL_OVERRIDES with a reason`
        )
    ).toEqual([]);
    expect(
      Object.keys(LOCAL_OVERRIDES)
        .filter((key) => !differing.some((entry) => entry.key === key))
        .map((key) => `${key} no longer differs from its default: remove it from LOCAL_OVERRIDES`)
    ).toEqual([]);
  });

  it('files each live schema key under the .env.example heading of its group', () => {
    const titleOf = Object.fromEntries(ENV_GROUPS.map(({ id, title }) => [id, title]));
    const misfiled = exampleEntries()
      .filter((entry) => !entry.commented && entry.key in ENV_DOCS)
      .filter(
        (entry) =>
          !entry.section.startsWith(
            titleOf[ENV_DOCS[entry.key as keyof typeof ENV_DOCS].group] as string
          )
      )
      .map(
        (entry) =>
          `${entry.key} sits under "${entry.section}" in .env.example but belongs to "${titleOf[ENV_DOCS[entry.key as keyof typeof ENV_DOCS].group]}": move the line or change its group in ${SCHEMA_DIR}/env-docs-*.ts`
      );

    expect(misfiled).toEqual([]);
  });

  it('shows a secret as secret everywhere and ships no real value for one', () => {
    const entries = exampleEntries();
    const docs = { ...ENV_DOCS, ...EXTRA_ENV_DOCS };
    const bySchema = secretSchemaKeys(read(`${SCHEMA_DIR}/app-env.ts`), SECRET_KEYS);

    expect(visibilityFindings(docs, bySchema, entries)).toEqual([]);
    expect(lockedValueFindings(entries, heldLocalCredentials)).toEqual([]);
  });

  it('lists every key in docs/ENVIRONMENT.md, and that file is what the generator writes', async () => {
    const document = read('docs/ENVIRONMENT.md');
    const keys = [...Object.keys(ENV_DOCS), ...Object.keys(EXTRA_ENV_DOCS), ...platformKeys()];

    expect(
      keys
        .filter((key) => !document.includes(`\`${key}\``))
        .map((key) => `${key} is missing from docs/ENVIRONMENT.md: run pnpm gen:env-docs`)
    ).toEqual([]);
    expect(
      (await renderFor(ROOT)) === document,
      'docs/ENVIRONMENT.md is stale: run pnpm gen:env-docs and commit it'
    ).toBe(true);
  });
});
