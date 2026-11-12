import type { DemoHost, ExecResult } from '../host';
import { parseDemoCommand, type DemoRunOptions } from '../options';

type Answer = Partial<ExecResult> | ((args: readonly string[]) => Partial<ExecResult>);

export interface Setup {
  files?: Record<string, string>;
  answers?: Partial<Record<string, Answer>>;
  env?: Record<string, string | undefined>;
  platform?: NodeJS.Platform;
  nodeVersion?: string;
  tty?: boolean;
  httpOk?: boolean;
  showCode?: (line: string) => number;
}

const HEALTHY: Record<string, Answer> = {
  'pnpm -v': { stdout: '12.0.1\n' },
  'docker info': { stdout: '27.0.0\n' },
  'docker compose version': { stdout: 'v2.29.0\n' },
  'ffmpeg -version': { stdout: 'ffmpeg version 7\n' },
  'pnpm --silent preflight': {},
};

/** A host that records every command and answers by its first words; the defaults are a healthy machine. */
export function fakeHost(setup: Setup = {}) {
  const files = new Map(Object.entries(setup.files ?? {}));
  const printed: string[] = [];
  const shown: string[] = [];
  const captured: string[] = [];
  const removed: string[] = [];
  let clock = 0;
  const answers = { ...HEALTHY, ...setup.answers };
  const answer = (command: string, args: readonly string[]): ExecResult => {
    const line = [command, ...args].join(' ');
    const key = Object.keys(answers).find((k) => line.startsWith(k));
    const found = key === undefined ? undefined : answers[key];
    const value = typeof found === 'function' ? found(args) : found;
    return {
      code: 0,
      stdout: '',
      stderr: '',
      ...(key === undefined && command === 'lsof' ? { code: 1 } : {}),
      ...value,
    };
  };
  const host: DemoHost = {
    cwd: '/repo',
    env: setup.env ?? {},
    platform: setup.platform ?? 'darwin',
    nodeVersion: setup.nodeVersion ?? 'v24.1.0',
    tty: setup.tty ?? false,
    now: () => (clock += 100),
    print: (line) => printed.push(line),
    show: async (command, args) => {
      const line = [command, ...args].join(' ');
      shown.push(line);
      return setup.showCode?.(line) ?? 0;
    },
    capture: async (command, args) => {
      captured.push([command, ...args].join(' '));
      return answer(command, args);
    },
    fileExists: (path) => files.has(path),
    readFile: (path) => files.get(path),
    writeFile: (path, text) => void files.set(path, text),
    removePath: (path) => {
      removed.push(path);
      for (const key of [...files.keys()])
        if (key === path || key.startsWith(`${path}/`)) files.delete(key);
    },
    httpOk: async () => setup.httpOk ?? true,
  };
  return { host, files, printed, shown, captured, removed, text: () => printed.join('\n') };
}

export function optionsFrom(
  argv: string[] = [],
  env: Record<string, string | undefined> = {}
): DemoRunOptions {
  const parsed = parseDemoCommand(['up', ...argv], env);
  if (!parsed.ok || parsed.value.kind === 'help' || parsed.value.kind === 'login') {
    throw new Error(`bad fixture: ${JSON.stringify(argv)}`);
  }
  return parsed.value.options;
}
