import { rmSync } from 'node:fs';
import { run, USAGE } from '../cli';
import { fakeHost, workspace } from './host-fixture';

let root: string;

beforeEach(() => {
  root = workspace();
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('run', () => {
  it.each([
    { argv: ['--help'], exit: 0 },
    { argv: [], exit: 2 },
    { argv: ['nonsense'], exit: 2 },
    { argv: ['validate', '--bogus'], exit: 2 },
  ])('prints the usage for $argv and exits $exit', ({ argv, exit }) => {
    const host = fakeHost(root);

    expect(run(argv, host)).toBe(exit);
    expect(host.printed.at(-1)).toBe(
      argv.includes('--bogus') ? "Unknown option '--bogus'. See pnpm envctl --help." : USAGE
    );
  });

  it.each([
    { argv: ['list'], exit: 0 },
    { argv: ['validate'], exit: 0 },
    { argv: ['get', 'production', 'kind'], exit: 0 },
    { argv: ['namespace', 'preview', '--slug', 'x'], exit: 0 },
    { argv: ['render', 'production', '--tag', 'v1'], exit: 0 },
    { argv: ['tag', 'production', '--tag', 'v1'], exit: 0 },
    { argv: ['secrets-check', 'production'], exit: 1 },
    { argv: ['gate', 'production', '--context', 'k3s-prod', '--tag', 'v1', '--yes'], exit: 0 },
    { argv: ['gate', 'production', '--context', 'elsewhere', '--tag', 'v1', '--yes'], exit: 1 },
    { argv: ['preview-slug', 'Feat/X'], exit: 0 },
    { argv: ['migrations-check'], exit: 3 },
    { argv: ['expired-previews'], exit: 2 },
  ])('dispatches $argv', ({ argv, exit }) => {
    expect(run(argv, fakeHost(root))).toBe(exit);
  });

  it('documents every command it dispatches', () => {
    for (const command of [
      'list',
      'validate',
      'get',
      'namespace',
      'render',
      'tag',
      'secrets-check',
      'gate',
      'migrations-check',
      'preview-slug',
      'expired-previews',
    ]) {
      expect(USAGE).toContain(command);
    }
  });
});
