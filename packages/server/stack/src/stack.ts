import { type Result, err, ok } from '@vp/result';
import { describeState, formatTable, hasFailed, parseContainers } from './containers';
import { type Topology, parseTopology, profilesOf, selectServices, tiers } from './topology';

export interface Docker {
  /** Runs `docker <args>` with its output going to the terminal, and resolves to its exit code. */
  show(args: readonly string[]): Promise<number>;
  /** Runs `docker <args>` and resolves to its exit code and what it printed. */
  capture(args: readonly string[]): Promise<{ code: number; stdout: string; stderr: string }>;
}

export interface StackHost {
  docker: Docker;
  files: readonly string[];
  print: (text: string) => void;
}

export interface UpOptions {
  build: boolean;
  waitTimeoutSec: number;
}

const LOG_LINES = '40';

function composeWith(host: StackHost, profiles: readonly string[]) {
  const head = [
    'compose',
    ...host.files.flatMap((file) => ['-f', file]),
    ...profiles.flatMap((profile) => ['--profile', profile]),
  ];
  return (...args: string[]) => [...head, ...args];
}

interface Loaded {
  topology: Topology;
  profiles: string[];
}

async function loadTopology(host: StackHost): Promise<Result<Loaded, string>> {
  const listed = await host.docker.capture(composeWith(host, [])('config', '--profiles'));
  if (listed.code !== 0) return err(listed.stderr);
  const profiles = listed.stdout.split('\n').filter((line) => line.trim() !== '');
  const config = await host.docker.capture(
    composeWith(host, profiles)('config', '--format', 'json')
  );
  if (config.code !== 0) return err(config.stderr);
  return ok({ topology: parseTopology(config.stdout), profiles });
}

async function withTopology(
  host: StackHost,
  run: (loaded: Loaded) => Promise<number>
): Promise<number> {
  const loaded = await loadTopology(host);
  if (loaded.ok) return run(loaded.value);
  host.print(`docker compose could not read ${host.files.join(', ')}:\n${loaded.error.trimEnd()}`);
  return 1;
}

async function reportFailure(
  host: StackHost,
  compose: (...args: string[]) => string[],
  topology: Topology,
  started: readonly string[]
): Promise<void> {
  const ps = await host.docker.capture(compose('ps', '--all', '--format', 'json', ...started));
  const failed = parseContainers(ps.stdout).filter((c) =>
    hasFailed(c, topology.get(c.service)?.oneShot ?? false)
  );
  if (failed.length === 0) {
    host.print(
      `Failed to start: ${started.join(', ')}. No container reported why; see the output above.`
    );
    return;
  }
  for (const container of failed) {
    host.print(
      `\n${container.service} failed: ${describeState(container)}. Its last ${LOG_LINES} lines:`
    );
    const logs = await host.docker.capture(
      compose('logs', '--no-color', '--no-log-prefix', '--tail', LOG_LINES, container.service)
    );
    host.print(logs.stdout.trimEnd());
  }
}

/** Starts what the targets name and everything it depends on, one tier at a time, each gated on health. */
export function up(
  host: StackHost,
  targets: readonly string[],
  options: UpOptions
): Promise<number> {
  return withTopology(host, ({ topology }) => upTopology(host, topology, targets, options));
}

async function upTopology(
  host: StackHost,
  topology: Topology,
  targets: readonly string[],
  options: UpOptions
): Promise<number> {
  const selected = selectServices(topology, targets);
  if (!selected.ok) {
    host.print(`Unknown target "${selected.error.unknownTarget}".`);
    return 2;
  }
  const levels = tiers(topology, selected.value);
  const services = levels.flat();
  const compose = composeWith(host, profilesOf(topology, services));

  const built = services.filter((name) => topology.get(name)?.built);
  if (options.build && built.length > 0) {
    const code = await host.docker.show(compose('build', ...built));
    if (code !== 0) {
      host.print(`Building ${built.join(', ')} failed.`);
      return code;
    }
  }

  const started: string[] = [];
  for (const level of levels) {
    started.push(...level);
    const wait = ['--wait', '--wait-timeout', String(options.waitTimeoutSec)];
    const upCode = await host.docker.show(
      compose('up', '--detach', '--no-build', ...wait, ...level)
    );
    const oneShots = level.filter((name) => topology.get(name)?.oneShot);
    const waitCode =
      upCode === 0 && oneShots.length > 0
        ? await host.docker.show(compose('wait', ...oneShots))
        : 0;
    if (upCode !== 0 || waitCode !== 0) {
      await reportFailure(host, compose, topology, started);
      return 1;
    }
  }

  const ps = await host.docker.capture(compose('ps', '--all', '--format', 'json', ...services));
  host.print(`\n${formatTable(parseContainers(ps.stdout))}`);
  return 0;
}

export function down(host: StackHost): Promise<number> {
  return withTopology(host, ({ profiles }) =>
    host.docker.show(
      composeWith(host, profiles)('down', '--volumes', '--remove-orphans', '--timeout', '1')
    )
  );
}

export function status(host: StackHost): Promise<number> {
  return withTopology(host, async ({ profiles }) => {
    const compose = composeWith(host, profiles);
    const ps = await host.docker.capture(compose('ps', '--all', '--format', 'json'));
    const containers = parseContainers(ps.stdout);
    host.print(containers.length === 0 ? 'Nothing is running.' : formatTable(containers));
    return ps.code;
  });
}
