import type { EnvKeyShape } from '../../../packages/server/env-schema/src/index';
import { buildModel, type EnvModelInput } from '../model';
import { parseEnvExample } from '../parse-example';

const body = { description: 'd', example: 'e', visibility: 'public', readBy: ['api'] } as const;

const SHAPES: Record<string, EnvKeyShape> = {
  PORT: { type: 'integer >= 0', default: { kind: 'value', value: '3000', parsed: 3000 } },
  TRUST_PROXY: { type: 'comma list', default: { kind: 'value', value: '', parsed: [] } },
  DATABASE_URL: { type: 'url', default: { kind: 'required' } },
  REDIS_PASSWORD: { type: 'string', default: { kind: 'unset' } },
  ADMIN_TOKEN: { type: 'string', default: { kind: 'unset' } },
};

const input = (overrides: Partial<EnvModelInput> = {}): EnvModelInput =>
  ({
    docs: {
      PORT: { ...body, group: 'core' },
      TRUST_PROXY: { ...body, group: 'core' },
      DATABASE_URL: {
        ...body,
        group: 'postgres',
        visibility: 'secret',
        requiredIn: ['always', 'production'],
      },
      REDIS_PASSWORD: { ...body, group: 'redis', visibility: 'secret', requiredIn: ['production'] },
      ADMIN_TOKEN: { ...body, group: 'auth', visibility: 'secret' },
    },
    groups: [
      { id: 'core', title: 'Core', summary: 'c' },
      { id: 'postgres', title: 'PostgreSQL', summary: 'p' },
    ],
    describe: (key: string) => SHAPES[key] as EnvKeyShape,
    extraDocs: {
      VITE_WEB_URL: { ...body, group: 'client', readBy: ['web'] },
      WORKER_RUNTIME: { ...body, group: 'platform', readBy: ['infra'] },
    },
    extraGroups: [{ id: 'client', title: 'Client', summary: 'x' }],
    platform: { WORKER_RUNTIME: 'the worker image' },
    example: parseEnvExample(
      'DATABASE_URL=postgres://vp:vp@localhost:5432/vp  # 🔒\nPORT=3000\nREDIS_PASSWORD=\n# ADMIN_TOKEN=x\n'
    ),
    ...overrides,
  }) as EnvModelInput;

describe('scripts: env-docs/model', () => {
  it('groups rows in the registry order and drops groups the list leaves out', () => {
    const { groups } = buildModel(input());

    expect(groups.map(({ id, rows }) => [id, rows.map((row) => row.name)])).toEqual([
      ['core', ['PORT', 'TRUST_PROXY']],
      ['postgres', ['DATABASE_URL']],
    ]);
  });

  it.each([
    { name: 'PORT', type: 'integer >= 0', defaultText: '`3000`', requiredIn: '', secret: false },
    {
      name: 'TRUST_PROXY',
      type: 'comma list',
      defaultText: 'empty',
      requiredIn: '',
      secret: false,
    },
    {
      name: 'DATABASE_URL',
      type: 'url',
      defaultText: 'required',
      requiredIn: 'always, production',
      secret: true,
    },
  ])('reads the type, default and requirement of $name from the shape and the doc', (expected) => {
    const rows = buildModel(input()).groups.flatMap(({ rows }) => rows);

    expect(rows.find((row) => row.name === expected.name)).toMatchObject(expected);
  });

  it('names the platform consumer, or else the readers, of a key outside the schema', () => {
    const extras = buildModel(
      input({
        extraGroups: [
          { id: 'client', title: 'C', summary: 's' },
          { id: 'platform', title: 'P', summary: 's' },
        ],
      })
    ).extras;

    expect(extras.flatMap(({ rows }) => rows.map((row) => [row.name, row.consumer]))).toEqual([
      ['VITE_WEB_URL', 'web'],
      ['WORKER_RUNTIME', 'the worker image'],
    ]);
  });

  it('lists the keys with no default that .env.example sets, in the registry order', () => {
    expect(buildModel(input()).minimalLocal).toEqual([
      { name: 'DATABASE_URL', value: 'postgres://vp:vp@localhost:5432/vp' },
    ]);
  });
});
