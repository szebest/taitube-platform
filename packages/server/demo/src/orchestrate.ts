import { parseEnv } from 'node:util';
import type { DemoHost } from './host';
import { findPersona, mintArgs, renderLogin } from './logins';
import type { DemoRunOptions } from './options';
import { renderSummary, seconds, styleFor, type Style } from './output';
import { planLines, render } from './plan';
import { checkPrerequisites } from './prereqs';
import { mediaPath, readState, statePath, summarizeSeed, writeState } from './state';
import { IMAGES_PRESENT, STACK_DOWN, STACK_STATUS, STACK_STOP, stackUp } from './targets';
import type { SeedHost, SeedReport, DemoOptions } from './types';
import { CREDENTIAL_FALLBACKS, type Credentials, endpoints } from './urls';

export type SeedFn = (options: DemoOptions, host: SeedHost) => Promise<SeedReport>;

export const EXIT = { ok: 0, failure: 1, usage: 2, prerequisite: 3 } as const;

const MODELS = [
  '.models/ggml-small-q5_1.bin',
  '.models/ggml-silero-v5.1.2.bin',
  '.models/vit-base-nsfw-detector-int8.onnx',
];

function credentials(host: DemoHost): Credentials {
  const env = parseEnv(host.readFile('.env') ?? '');
  return {
    adminToken: env.ADMIN_TOKEN || CREDENTIAL_FALLBACKS.adminToken,
    storageUser: env.S3_ACCESS_KEY_ID || CREDENTIAL_FALLBACKS.storageUser,
    storagePassword: env.S3_SECRET_ACCESS_KEY || CREDENTIAL_FALLBACKS.storagePassword,
  };
}

function dryRun(
  host: DemoHost,
  kind: Parameters<typeof planLines>[0],
  options: DemoRunOptions,
  persona?: string
): number {
  for (const line of planLines(kind, options, endpoints(options, credentials(host)), persona)) {
    host.print(line);
  }
  return EXIT.ok;
}

async function step<T>(
  host: DemoHost,
  label: string,
  work: () => Promise<T>
): Promise<{ value: T; ms: number }> {
  host.print(label);
  const started = host.now();
  const value = await work();
  return { value, ms: host.now() - started };
}

async function prerequisites(
  host: DemoHost,
  options: DemoRunOptions,
  style: Style
): Promise<boolean> {
  const checks = await checkPrerequisites(host, options);
  for (const c of checks) {
    host.print(`    ${c.ok ? style.green('ok  ') : style.red('FAIL')} ${c.id}: ${c.detail}`);
    if (!c.ok) host.print(`         fix: ${c.hint}`);
  }
  return checks.every((c) => c.ok);
}

function ensureEnv(host: DemoHost): boolean {
  if (host.fileExists('.env')) return true;
  const example = host.readFile('.env.example');
  if (example === undefined) return false;
  host.writeFile('.env', example);
  return true;
}

async function seedWorld(
  host: DemoHost,
  options: DemoRunOptions,
  seed: SeedFn
): Promise<SeedReport> {
  const env = parseEnv(host.readFile('.env') ?? '');
  const report = await seed(options, {
    log: (line) => host.print(`    ${line}`),
    databaseUrl: env.DATABASE_URL,
    cdnBaseUrl: env.CDN_BASE_URL,
    environment: env.NODE_ENV,
  });
  const previous = readState(host, options);
  writeState(host, options, previous.ok ? previous.value : undefined, report);
  return report;
}

async function wipe(host: DemoHost, options: DemoRunOptions): Promise<number> {
  const code = await host.show(STACK_DOWN.command, STACK_DOWN.args);
  host.removePath(statePath(options));
  if (options.purgeMedia) host.removePath(mediaPath(options));
  return code;
}

export async function runUp(
  host: DemoHost,
  options: DemoRunOptions,
  seed: SeedFn
): Promise<number> {
  if (options.dryRun) return dryRun(host, options.reset ? 'reset' : 'up', options);
  const style = styleFor(host.tty, host.env);
  const total = host.now();
  const timings: string[] = [];
  const mark = (name: string, ms: number) => timings.push(`${name} ${seconds(ms)}`);

  const prereq = await step(host, '[1/5] prerequisites', () => prerequisites(host, options, style));
  mark('prerequisites', prereq.ms);
  if (!prereq.value) return EXIT.prerequisite;

  const env = await step(host, '[2/5] .env', async () => ensureEnv(host));
  mark('.env', env.ms);
  if (!env.value) {
    host.print('    .env.example is missing: run this from the repository root');
    return EXIT.failure;
  }

  if (options.reset && (await wipe(host, options)) !== 0) return EXIT.failure;

  const stack = await step(host, '[3/5] stack', async () => {
    const haveImages =
      options.noBuild &&
      (await host.capture(IMAGES_PRESENT.command, IMAGES_PRESENT.args)).code === 0;
    if (options.noBuild && !haveImages) host.print('    images are missing: building them');
    const command = stackUp(options, !haveImages);
    host.print(`    ${render(command)}`);
    return host.show(command.command, command.args);
  });
  mark('stack', stack.ms);
  if (stack.value !== 0) return EXIT.failure;

  const seeded = await step(host, '[4/5] seed', async () => {
    if (options.profile === 'full' && MODELS.some((m) => !host.fileExists(m))) {
      host.print(
        '    warning: .models/ lacks the captions and screening models. The worker image carries its own, downloaded once at build; for host runs: pnpm models:fetch (needs network, once)'
      );
    }
    return seedWorld(host, options, seed);
  });
  mark('seed', seeded.ms);
  host.print(`    ${summarizeSeed(seeded.value)}`);

  host.print('[5/5] ready');
  host.print(renderSummary(endpoints(options, credentials(host)), style));
  host.print(style.dim(`\n${timings.join(', ')}, total ${seconds(host.now() - total)}`));
  return seeded.value.steps.some((s) => s.status === 'failed') ? EXIT.failure : EXIT.ok;
}

export async function runSeed(
  host: DemoHost,
  options: DemoRunOptions,
  seed: SeedFn
): Promise<number> {
  if (options.dryRun) return dryRun(host, 'seed', options);
  if (!(await host.httpOk(`${options.apiUrl}/healthz`))) {
    host.print(`The API does not answer at ${options.apiUrl}/healthz. Start it with: pnpm demo`);
    return EXIT.failure;
  }
  const report = await seedWorld(host, options, seed);
  host.print(summarizeSeed(report));
  return report.steps.some((s) => s.status === 'failed') ? EXIT.failure : EXIT.ok;
}

export async function runReset(
  host: DemoHost,
  options: DemoRunOptions,
  seed: SeedFn
): Promise<number> {
  if (options.dryRun) return dryRun(host, 'reset', options);
  if ((await wipe(host, options)) !== 0) return EXIT.failure;
  return runUp(host, { ...options, reset: false }, seed);
}

export async function runDown(host: DemoHost, options: DemoRunOptions): Promise<number> {
  if (options.dryRun) return dryRun(host, 'down', options);
  const code = await host.show(STACK_STOP.command, STACK_STOP.args);
  if (code === 0)
    host.print(
      'Stopped. The data is kept: pnpm demo starts it again in seconds. pnpm demo reset wipes it.'
    );
  return code === 0 ? EXIT.ok : EXIT.failure;
}

export async function runStatus(host: DemoHost, options: DemoRunOptions): Promise<number> {
  if (options.dryRun) return dryRun(host, 'status', options);
  const code = await host.show(STACK_STATUS.command, STACK_STATUS.args);
  const style = styleFor(host.tty, host.env);
  host.print(renderSummary(endpoints(options, credentials(host)), style));
  const state = readState(host, options);
  if (!state.ok) host.print(state.error);
  else if (state.value?.seed) {
    host.print(`\nLast seed ${state.value.updatedAt}: ${summarizeSeed(state.value.seed)}`);
  } else host.print('\nNot seeded yet: pnpm demo');
  return code === 0 ? EXIT.ok : EXIT.failure;
}

export async function runLogin(
  host: DemoHost,
  options: DemoRunOptions,
  name: string
): Promise<number> {
  const persona = findPersona(name);
  if (!persona) return EXIT.usage;
  if (options.dryRun) return dryRun(host, 'login', options, name);
  const minted = await host.capture('pnpm', mintArgs(persona));
  if (minted.code !== 0 || minted.stdout.trim() === '') {
    host.print(`Could not mint a token: ${minted.stderr.trim() || 'pnpm dev-token failed'}`);
    return EXIT.failure;
  }
  host.print(renderLogin(persona, minted.stdout.trim(), options.apiUrl));
  return EXIT.ok;
}
