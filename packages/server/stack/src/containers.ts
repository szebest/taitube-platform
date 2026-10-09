import { z } from 'zod';

const PsRowSchema = z.object({
  Service: z.string(),
  State: z.string(),
  Health: z.string().default(''),
  ExitCode: z.number().default(0),
  Publishers: z
    .array(z.object({ PublishedPort: z.number() }))
    .nullable()
    .default([]),
});

export interface Container {
  readonly service: string;
  readonly state: string;
  readonly health: string;
  readonly exitCode: number;
  readonly urls: readonly string[];
}

/** Reads `docker compose ps --format json`: one object per line, or one array from older Compose. */
export function parseContainers(output: string): Container[] {
  const trimmed = output.trim();
  if (trimmed === '') return [];
  const rows: unknown[] = trimmed.startsWith('[')
    ? JSON.parse(trimmed)
    : trimmed.split('\n').map((line) => JSON.parse(line));
  return rows.map((row) => {
    const { Service, State, Health, ExitCode, Publishers } = PsRowSchema.parse(row);
    const ports = new Set(
      (Publishers ?? []).map((p) => p.PublishedPort).filter((port) => port > 0)
    );
    return {
      service: Service,
      state: State,
      health: Health,
      exitCode: ExitCode,
      urls: [...ports].sort((a, b) => a - b).map((port) => `http://localhost:${port}`),
    };
  });
}

/** Whether the container is the reason a start failed; `oneShot` is a service meant to exit 0. */
export function hasFailed(container: Container, oneShot: boolean): boolean {
  switch (container.state) {
    case 'exited':
      return container.exitCode !== 0 || !oneShot;
    case 'running':
      return container.health === 'unhealthy';
    case 'restarting':
    case 'dead':
      return true;
    default:
      return false;
  }
}

export function describeState(container: Container): string {
  if (container.state === 'exited') return `exited (${container.exitCode})`;
  return container.health === '' ? container.state : `${container.state} (${container.health})`;
}

export function formatTable(containers: readonly Container[]): string {
  const rows: [string, string, string][] = [
    ['SERVICE', 'STATE', 'URL'],
    ...[...containers]
      .sort((a, b) => a.service.localeCompare(b.service))
      .map((c): [string, string, string] => [c.service, describeState(c), c.urls.join(' ')]),
  ];
  const serviceWidth = Math.max(...rows.map(([service]) => service.length));
  const stateWidth = Math.max(...rows.map(([, state]) => state.length));
  return rows
    .map(([service, state, url]) =>
      `${service.padEnd(serviceWidth)}  ${state.padEnd(stateWidth)}  ${url}`.trimEnd()
    )
    .join('\n');
}
