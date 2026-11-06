import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runEntrypoint } from '../../packages/server/testing/src/run-entrypoint';

const git = (cwd: string, ...args: string[]) =>
  spawnSync('git', args, { cwd, encoding: 'utf8' }).stdout.trim();

function checkout(previousHook?: string) {
  const root = mkdtempSync(join(tmpdir(), 'install-git-hooks-'));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  git(root, 'init', '-q');
  git(root, 'config', 'core.hooksPath', '.vite-hooks/_');
  if (previousHook !== undefined) writeFileSync(join(root, '.git/hooks/pre-commit'), previousHook);
  const install = () =>
    runEntrypoint(resolve(import.meta.dirname, '../install-git-hooks.ts'), [root], {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
    });
  return { root, install, hook: join(root, '.git/hooks/pre-commit') };
}

describe('scripts: install-git-hooks', () => {
  it('installs the shim, keeps the hook it replaces and unsets the hooks path vp config wrote', () => {
    const { root, install, hook } = checkout('#!/bin/sh\necho before\n');

    expect(install().status).toBe(0);
    expect(readFileSync(hook, 'utf8')).toContain('.vite-hooks/pre-commit');
    expect(readFileSync(`${hook}.previous`, 'utf8')).toBe('#!/bin/sh\necho before\n');
    expect(git(root, 'config', '--get', 'core.hooksPath')).toBe('');
  });

  it('leaves the kept hook alone on a second run', () => {
    const { install, hook } = checkout('#!/bin/sh\necho before\n');

    install();
    install();

    expect(readFileSync(`${hook}.previous`, 'utf8')).toBe('#!/bin/sh\necho before\n');
  });

  it('keeps nothing when there was no hook before', () => {
    const { install, hook } = checkout();

    install();

    expect(existsSync(`${hook}.previous`)).toBe(false);
  });
});
