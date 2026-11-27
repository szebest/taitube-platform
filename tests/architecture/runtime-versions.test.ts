import { load } from 'js-yaml';
import { read } from './repo-files';

const NODE_MAJOR = /(\d+)(?:\.\d+)*/;

/** The `ARG NAME=default` lines of the Dockerfile, by name. */
function dockerfileArgs(): Map<string, string> {
  return new Map(
    read('Dockerfile')
      .split('\n')
      .flatMap((line) => {
        const [, name, value] = /^ARG (\w+)=(\S+)$/.exec(line) ?? [];
        return name && value ? [[name, value] as const] : [];
      })
  );
}

function imageTag(argument: string, repository: string): string {
  const image = dockerfileArgs().get(argument) ?? '';
  const [tag = ''] = image.slice(`${repository}:`.length).split('@');
  return image.startsWith(`${repository}:`) ? tag : '';
}

const majorOf = (version: string): string => NODE_MAJOR.exec(version)?.[1] ?? '';
const minorOf = (version: string): string => version.split('.').slice(0, 2).join('.');

function setupBunVersion(): string {
  const action = load(read('.github/actions/setup-workspace/action.yml')) as {
    runs: { steps: { uses?: string; with?: Record<string, string> }[] };
  };
  const step = action.runs.steps.find(({ uses }) => uses?.startsWith('oven-sh/setup-bun'));
  return String(step?.with?.['bun-version'] ?? '');
}

describe('architecture: runtime-versions', () => {
  it('runs one Node major across the Dockerfile, engines.node and .nvmrc', () => {
    const engines = (JSON.parse(read('package.json')) as { engines: { node: string } }).engines;
    const majors = {
      Dockerfile: majorOf(imageTag('NODE_IMAGE', 'node')),
      'engines.node': majorOf(engines.node),
      '.nvmrc': majorOf(read('.nvmrc').trim()),
    };

    expect(Object.values(majors).every(Boolean)).toBe(true);
    expect(new Set(Object.values(majors)).size, JSON.stringify(majors)).toBe(1);
  });

  it('runs one Bun minor across the Dockerfile and the setup-bun step', () => {
    const minors = {
      Dockerfile: minorOf(imageTag('BUN_IMAGE', 'oven/bun').replace(/-.*$/, '')),
      'setup-workspace': minorOf(setupBunVersion()),
    };

    expect(Object.values(minors).every((minor) => /^\d+\.\d+$/.test(minor))).toBe(true);
    expect(new Set(Object.values(minors)).size, JSON.stringify(minors)).toBe(1);
  });
});
