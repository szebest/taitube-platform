import { parseJson } from '@vp/result';
import { z } from 'zod';
import type { DemoHost } from './host';
import type { DemoRunOptions } from './options';
import { COMPOSE_PS, requiredPorts } from './targets';

/** @internal Exported for its spec. */
export type PlatformKind = 'macos' | 'linux' | 'wsl';

export interface Check {
  id: 'node' | 'pnpm' | 'docker' | 'compose' | 'ffmpeg' | 'disk' | 'ports';
  ok: boolean;
  detail: string;
  hint: string;
}

/** @internal Exported for its spec. */
export function platformKind(host: Pick<DemoHost, 'platform' | 'env'>): PlatformKind {
  if (host.platform === 'darwin') return 'macos';
  return host.env.WSL_DISTRO_NAME || host.env.WSL_INTEROP ? 'wsl' : 'linux';
}

const HINTS: Record<Check['id'], Record<PlatformKind, string>> = {
  node: {
    macos: 'brew install node@24, then restart the shell',
    linux: 'install Node 24 (nvm install 24, or your distro NodeSource package)',
    wsl: 'install Node 24 inside WSL (nvm install 24), not the Windows one',
  },
  pnpm: {
    macos: 'corepack enable && corepack prepare pnpm@12 --activate (or brew install pnpm)',
    linux: 'corepack enable && corepack prepare pnpm@12 --activate',
    wsl: 'corepack enable && corepack prepare pnpm@12 --activate, inside WSL',
  },
  docker: {
    macos: 'start Docker Desktop, or: brew install colima docker && colima start',
    linux: 'start the daemon: sudo systemctl start docker, and add yourself to the docker group',
    wsl: 'start Docker Desktop and enable Settings > Resources > WSL integration for this distro',
  },
  compose: {
    macos: 'brew install docker-compose (Compose v2), or update Docker Desktop',
    linux: 'install the docker-compose-plugin package (Compose v2)',
    wsl: 'update Docker Desktop (Compose v2 ships with it)',
  },
  ffmpeg: {
    macos: 'brew install ffmpeg',
    linux: 'sudo apt-get install ffmpeg (or your distro equivalent)',
    wsl: 'sudo apt-get install ffmpeg, inside WSL',
  },
  disk: {
    macos:
      'free space; on colima: docker system prune -a, or colima stop && colima start --disk <GiB>',
    linux: 'free space: docker system prune -a, and remove old node_modules',
    wsl: 'free space: docker system prune -a, and compact the WSL disk',
  },
  ports: {
    macos:
      'stop the process named above (kill <pid>), or docker ps to find the container holding it',
    linux:
      'stop the process named above (kill <pid>), or docker ps to find the container holding it',
    wsl: 'stop the process named above, or docker ps to find the container holding it',
  },
};

/** @internal Exported for its spec. */
export function hintFor(check: Pick<Check, 'id'>, kind: PlatformKind): string {
  return HINTS[check.id][kind];
}

function check(id: Check['id'], ok: boolean, detail: string, kind: PlatformKind): Check {
  return { id, ok, detail, hint: ok ? '' : hintFor({ id }, kind) };
}

const PublisherSchema = z.object({
  Publishers: z.array(z.object({ PublishedPort: z.number() })).nullish(),
});

function ownPorts(stdout: string): Set<number> {
  const trimmed = stdout.trim();
  const lines = trimmed.startsWith('[') ? [trimmed] : trimmed.split('\n');
  const ports = new Set<number>();
  for (const line of lines) {
    if (line === '') continue;
    const json = parseJson(line);
    if (!json.ok) continue;
    for (const row of Array.isArray(json.value) ? json.value : [json.value]) {
      const parsed = PublisherSchema.safeParse(row);
      for (const p of parsed.success ? (parsed.data.Publishers ?? []) : [])
        ports.add(p.PublishedPort);
    }
  }
  return ports;
}

/** @internal Exported for its spec. */
export interface Listener {
  port: number;
  pid: string;
  name: string;
}

/** @internal Exported for its spec. */
export function parseListeners(output: string): Listener[] {
  const listeners: Listener[] = [];
  let pid = '';
  let name = '';
  for (const line of output.split('\n')) {
    const field = line.slice(1);
    if (line.startsWith('p')) pid = field;
    else if (line.startsWith('c')) name = field;
    else if (line.startsWith('n')) {
      const port = Number(field.slice(field.lastIndexOf(':') + 1));
      if (Number.isInteger(port)) listeners.push({ port, pid, name });
    }
  }
  return listeners;
}

async function portCheck(
  host: DemoHost,
  options: DemoRunOptions,
  kind: PlatformKind
): Promise<Check> {
  const ports = requiredPorts(options);
  const lsof = await host.capture('lsof', [
    '-nP',
    `-iTCP:${ports.join(',')}`,
    '-sTCP:LISTEN',
    '-Fpcn',
  ]);
  if (lsof.code === 127) return check('ports', true, 'lsof not found, port check skipped', kind);
  const held = parseListeners(lsof.stdout);
  if (held.length === 0) return check('ports', true, `${ports.join(', ')} free`, kind);
  const ps = await host.capture(COMPOSE_PS.command, COMPOSE_PS.args);
  const own = ownPorts(ps.stdout);
  const foreign = held.filter((l) => !own.has(l.port));
  if (foreign.length === 0) return check('ports', true, 'held by this stack', kind);
  const holders = foreign.map((l) => `${l.port} by ${l.name} (pid ${l.pid})`).join('; ');
  return check('ports', false, holders, kind);
}

export async function checkPrerequisites(
  host: DemoHost,
  options: DemoRunOptions
): Promise<Check[]> {
  const kind = platformKind(host);
  const [pnpm, docker, compose, ffmpeg, disk, ports] = await Promise.all([
    host.capture('pnpm', ['-v']),
    host.capture('docker', ['info', '--format', '{{.ServerVersion}}']),
    host.capture('docker', ['compose', 'version', '--short']),
    host.capture('ffmpeg', ['-version']),
    host.capture('pnpm', ['--silent', 'preflight']),
    portCheck(host, options, kind),
  ]);
  const composeMajor = Number(compose.stdout.trim().replace(/^v/, '').split('.')[0]);
  return [
    check('node', host.nodeVersion.startsWith('v24.'), host.nodeVersion, kind),
    check(
      'pnpm',
      pnpm.code === 0 && pnpm.stdout.trim().startsWith('12.'),
      pnpm.stdout.trim() || 'not found',
      kind
    ),
    check(
      'docker',
      docker.code === 0,
      docker.code === 0 ? `daemon ${docker.stdout.trim()}` : 'daemon not reachable',
      kind
    ),
    check(
      'compose',
      compose.code === 0 && composeMajor >= 2,
      compose.stdout.trim() || 'not found',
      kind
    ),
    check('ffmpeg', ffmpeg.code === 0, ffmpeg.code === 0 ? 'found' : 'not found', kind),
    check(
      'disk',
      disk.code === 0,
      disk.code === 0 ? 'enough free space' : disk.stderr.trim(),
      kind
    ),
    ports,
  ];
}
