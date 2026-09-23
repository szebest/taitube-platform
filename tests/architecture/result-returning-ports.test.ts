import { read, trackedFiles } from './repo-files';

/**
 * An I/O method that types as `Promise<T>` hides every way it can fail. `Promise<Result<T, E>>`
 * puts the narrow failure union for that port in the signature, where a caller has to answer it.
 *
 * Ticket 84 converted the last of them, so this is a flat assertion now: the shrink-only list it
 * used to read from is gone, and a port method that hides its failures is simply a failure here.
 */
const PORT_ROOTS = ['packages/server/core/ports/', 'packages/server/core/repositories/'];
const METHOD = /^\s*(?:abstract\s+)?(\w+)\s*(?:<[^>]*>)?\([^;]*?\):\s*(Promise<[^;]+)/gm;

function portFiles(): string[] {
  return trackedFiles(...PORT_ROOTS).filter(
    (file) => file.endsWith('.ts') && !file.endsWith('index.ts')
  );
}

function asyncMethods(file: string): { name: string; returns: string }[] {
  return [...read(file).matchAll(METHOD)].map((match) => ({
    name: match[1] as string,
    returns: (match[2] as string).replace(/\s+/g, ' ').trim(),
  }));
}

function offenders(): string[] {
  return portFiles().flatMap((file) =>
    asyncMethods(file)
      .filter(({ returns }) => !returns.startsWith('Promise<Result<'))
      .map(({ name }) => `${file}#${name}`)
  );
}

describe('architecture: every I/O port method returns a Result', () => {
  it('parses the port files it is asserting about', () => {
    expect(portFiles().length).toBeGreaterThan(15);
    expect(asyncMethods('packages/server/core/repositories/category-repository.ts')).not.toEqual(
      []
    );
  });

  it('finds no port method that hides its failures behind a bare promise', () => {
    expect(offenders()).toEqual([]);
  });
});
