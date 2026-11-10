import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import {
  type CommandInput,
  findEnvironment,
  confirm,
  gate,
  get,
  list,
  namespace,
  render,
  secretsCheck,
  tag,
  validate,
  vars,
} from '../environment-commands';
import { fakeHost, workspace } from './host-fixture';

const input = (overrides: Partial<CommandInput> = {}): CommandInput => ({
  environment: 'production',
  rest: [],
  slug: undefined,
  tag: undefined,
  file: undefined,
  context: undefined,
  yes: false,
  confirm: undefined,
  ...overrides,
});

let root: string;

beforeEach(() => {
  root = workspace();
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('findEnvironment', () => {
  it('finds a loaded environment', () => {
    expect(findEnvironment(fakeHost(root), 'production')).toMatchObject({
      ok: true,
      env: { name: 'production' },
    });
  });

  it('answers usage for an unknown name and lists the real ones', () => {
    const host = fakeHost(root);

    expect(findEnvironment(host, 'qa')).toEqual({ ok: false, exit: 2 });
    expect(host.printed.join('\n')).toBe(
      'unknown environment qa; one of: compose-vm, preview, production'
    );
  });

  it('answers failure when a file is wrong', () => {
    const broken = workspace([]);
    const host = fakeHost(broken);
    mkdirSync(`${broken}/infra/environments/x`, { recursive: true });
    writeFileSync(`${broken}/infra/environments/x/environment.yaml`, 'name: x\n');

    expect(findEnvironment(host, 'x')).toEqual({ ok: false, exit: 1 });
    rmSync(broken, { recursive: true, force: true });
  });
});

describe('list, validate and get', () => {
  it('lists name, kind and description', () => {
    const host = fakeHost(root);

    expect(list(host)).toBe(0);
    expect(host.printed.filter((line) => line !== '')).toEqual([
      'compose-vm\tcompose\tOne VM running the compose file.',
      'preview\tk3s\tThe environment real users reach.',
      'production\tk3s\tThe environment real users reach.',
    ]);
  });

  it('validates the environments against the registry', () => {
    const host = fakeHost(root);

    expect(validate(host)).toBe(0);
    expect(host.printed).toEqual(['3 environments valid']);
  });

  it.each([
    { path: 'kind', expected: 'k3s' },
    { path: 'cluster.context', expected: 'k3s-prod' },
    { path: 'health.smoke', expected: 'false' },
    { path: 'scaling.budget', expected: '{"cpu":"8","memory":"16Gi","pods":40}' },
  ])('prints $path as $expected', ({ path, expected }) => {
    const host = fakeHost(root);

    expect(get(host, input({ rest: [path] }))).toBe(0);
    expect(host.printed).toEqual([expected]);
  });

  it('fails on a path the environment lacks', () => {
    const host = fakeHost(root);

    expect(get(host, input({ rest: ['cluster.nope'] }))).toBe(1);
    expect(host.printed).toEqual(['production has no cluster.nope']);
  });
});

describe('namespace and render', () => {
  it.each([
    { name: 'production', slug: undefined, exit: 0, printed: 'video-pipeline' },
    { name: 'preview', slug: 'Feat/X', exit: 0, printed: 'preview-feat-x' },
    {
      name: 'preview',
      slug: undefined,
      exit: 2,
      printed: 'preview needs --slug <branch or PR>: its namespace is preview-{slug}',
    },
    {
      name: 'compose-vm',
      slug: undefined,
      exit: 2,
      printed: 'compose-vm is a compose environment: it has no namespace',
    },
  ])('namespace of $name for $slug', ({ name, slug, exit, printed }) => {
    const host = fakeHost(root);

    expect(namespace(host, input({ environment: name, slug }))).toBe(exit);
    expect(host.printed).toEqual([printed]);
  });

  it('writes the overlay and prints where', () => {
    const host = fakeHost(root);

    expect(render(host, input({ tag: 'v1.2.3' }))).toBe(0);
    expect(host.printed).toEqual(['.deploy/production']);
    expect([...host.written.keys()]).toEqual([
      '.deploy/production/kustomization.yaml',
      '.deploy/production/quota.yaml',
    ]);
  });

  it('resolves {sha} against HEAD, and asks for a tag when it cannot', () => {
    const withHead = fakeHost(root, { git: () => 'abc123\n' });
    const without = fakeHost(root);

    expect(render(withHead, input({ environment: 'preview', slug: 'x' }))).toBe(0);
    expect(withHead.written.get('.deploy/preview/kustomization.yaml')).toContain('sha-abc123');
    expect(render(without, input({ environment: 'preview', slug: 'x' }))).toBe(3);
  });

  it.each([
    {
      name: 'compose-vm',
      slug: undefined,
      message: 'compose-vm is a compose environment: nothing to render with kustomize',
    },
    { name: 'preview', slug: undefined, message: 'preview needs --slug <branch or PR>' },
  ])('refuses to render $name without what it needs', ({ name, slug, message }) => {
    const host = fakeHost(root);

    expect(render(host, input({ environment: name, slug }))).toBe(2);
    expect(host.printed).toEqual([message]);
  });

  it('prints the tag a deploy would use', () => {
    const host = fakeHost(root, { git: () => 'abc123\n' });

    expect(tag(host, input({ environment: 'preview' }))).toBe(0);
    expect(host.printed).toEqual(['sha-abc123']);
    expect(tag(fakeHost(root), input({ environment: 'preview' }))).toBe(3);
  });
});

describe('secretsCheck', () => {
  it('lists every secret as missing without a file, and prints no value', () => {
    const host = fakeHost(root);

    expect(secretsCheck(host, input())).toBe(1);
    expect(host.printed[0]).toBe(
      '.secrets/production.env does not exist: every expected secret is missing'
    );
    expect(host.printed[1]).toContain(
      'missing: DATABASE_URL, REDIS_PASSWORD, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY'
    );
  });

  it('passes a complete file named with --file', () => {
    const text = ['DATABASE_URL', 'REDIS_PASSWORD', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']
      .map((k) => `${k}=v-${k}`)
      .join('\n');
    const host = fakeHost(root, {
      readText: (path) => (path === 'elsewhere.env' ? text : undefined),
    });

    expect(secretsCheck(host, input({ file: 'elsewhere.env' }))).toBe(0);
    expect(host.printed[0]).toContain('secrets for production (elsewhere.env)');
  });
});

describe('gate', () => {
  it.each([
    {
      scenario: 'the right context, a pinned tag and --yes',
      args: { context: 'k3s-prod', tag: 'v1', yes: true },
      exit: 0,
      message: undefined,
    },
    {
      scenario: 'the right context, a pinned tag and the name typed',
      args: { context: 'k3s-prod', tag: 'v1', confirm: 'production' },
      exit: 0,
      message: undefined,
    },
    {
      scenario: 'a context the environment does not declare',
      args: { context: 'k3d-vp', tag: 'v1', yes: true },
      exit: 1,
      message:
        'refusing production: the current context is k3d-vp, the environment declares k3s-prod',
    },
    {
      scenario: 'a floating tag',
      args: { context: 'k3s-prod', yes: true },
      exit: 1,
      message: 'production is protected: pin an image tag, e.g. TAG=v1.2.3, not latest',
    },
    {
      scenario: 'no confirmation',
      args: { context: 'k3s-prod', tag: 'v1' },
      exit: 1,
      message: 'production is protected: pass --yes, or --confirm production',
    },
  ])('answers $exit for $scenario', ({ args, exit, message }) => {
    const host = fakeHost(root);

    expect(gate(host, input(args))).toBe(exit);
    expect(host.printed).toEqual(message === undefined ? [] : [message]);
  });

  it('reports every refusal at once', () => {
    const host = fakeHost(root);

    expect(gate(host, input({ context: 'k3d-vp' }))).toBe(1);
    expect(host.printed).toEqual([
      [
        'refusing production: the current context is k3d-vp, the environment declares k3s-prod',
        'production is protected: pin an image tag, e.g. TAG=v1.2.3, not latest',
        'production is protected: pass --yes, or --confirm production',
      ].join('\n'),
    ]);
  });

  it('leaves the tag out of a confirm, which a rollback pins nothing for', () => {
    expect(confirm(fakeHost(root), input({ context: 'k3s-prod', yes: true }))).toBe(0);
    expect(confirm(fakeHost(root), input({ context: 'k3s-prod' }))).toBe(1);
  });
});

describe('vars', () => {
  it('prints the environment as E_ lines for a shell', () => {
    const host = fakeHost(root);

    expect(vars(host, input())).toBe(0);
    expect(host.printed[0]).toContain("E_cluster_context='k3s-prod'");
  });

  it('answers usage for an unknown environment', () => {
    expect(vars(fakeHost(root), input({ environment: 'qa' }))).toBe(2);
  });
});
