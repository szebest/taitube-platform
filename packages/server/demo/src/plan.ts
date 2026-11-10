import type { Command } from './host';
import { findPersona, mintArgs } from './logins';
import type { DemoRunOptions } from './options';
import {
  requiredPorts,
  stackTargets,
  stackUp,
  STACK_DOWN,
  STACK_STATUS,
  STACK_STOP,
} from './targets';
import { type Endpoint } from './urls';

/** @internal Exported for its spec. */
export function seedLine(options: DemoRunOptions): string {
  const worker = options.withWorker ? 'through the worker pipeline' : 'rows only, no worker';
  return `seed ${options.videos} videos, ${options.users} users, ${options.channels} channels, seed ${options.seed}, ${worker}`;
}

function upSteps(options: DemoRunOptions, build: boolean): string[] {
  const prereqs = `node 24, pnpm 12, docker daemon, compose v2, ffmpeg, disk (pnpm --silent preflight), ports ${requiredPorts(options).join(' ')}`;
  return [
    `1 prerequisites: ${prereqs}`,
    '2 .env: copy .env.example when .env is absent, never overwrite',
    `3 stack: ${render(stackUp(options, build))}`,
    `4 ${seedLine(options)}`,
    '5 print the URLs and the persona logins',
  ];
}

export function render(command: Command): string {
  return [command.command, ...command.args].join(' ');
}

function commandLine(label: string, command: Command): string {
  return `${label}: ${render(command)}`;
}

export function planLines(
  kind: 'up' | 'seed' | 'reset' | 'down' | 'status' | 'login',
  options: DemoRunOptions,
  endpoints: readonly Endpoint[],
  persona?: string
): string[] {
  const build = !options.noBuild;
  const head = `Plan for pnpm demo ${kind} (dry run, nothing is executed)`;
  const targets = `targets: ${stackTargets(options).join(' ')}`;
  const urls = ['URLs:', ...endpoints.map((e) => `  ${e.label} ${e.url}`)];
  switch (kind) {
    case 'up':
      return [head, targets, ...upSteps(options, build), ...urls];
    case 'reset':
      return [
        head,
        commandLine('0 stack down, volumes deleted', STACK_DOWN),
        `0 remove ${options.workDir}/state.json${options.purgeMedia ? ` and ${options.workDir}/media` : ''}`,
        targets,
        ...upSteps(options, build),
        ...urls,
      ];
    case 'seed':
      return [head, seedLine(options), `state: ${options.workDir}/state.json`];
    case 'down':
      return [head, commandLine('stop, volumes kept', STACK_STOP)];
    case 'status':
      return [head, commandLine('stack', STACK_STATUS), ...urls];
    case 'login': {
      const found = persona === undefined ? undefined : findPersona(persona);
      return [
        head,
        found ? commandLine('mint', { command: 'pnpm', args: mintArgs(found) }) : 'no persona',
      ];
    }
  }
}
