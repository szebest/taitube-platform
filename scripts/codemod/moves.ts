import { readFileSync } from 'node:fs';

type Destinations = string | { readonly [key: string]: Destinations };
export type Moves = Readonly<Record<string, Destinations>>;

export const loadMoves = (file: string): Moves => JSON.parse(readFileSync(file, 'utf8'));

export type Resolution =
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'whole'; readonly specifier: string }
  | {
      readonly kind: 'by-name';
      readonly of: (name: string) => string;
      readonly every: readonly string[];
    };

const UNCHANGED: Resolution = { kind: 'unchanged' };

export function splitSpecifier(specifier: string): { packageName: string; subpath: string } | null {
  if (!specifier.startsWith('@')) return null;
  const [scope, name, ...rest] = specifier.split('/');
  if (!name) return null;
  return {
    packageName: `${scope}/${name}`,
    subpath: rest.length === 0 ? '.' : `./${rest.join('/')}`,
  };
}

const withSubpath = (destination: string, subpath: string): string =>
  subpath === '.' ? destination : `${destination}${subpath.slice(1)}`;

export function resolveSpecifier(moves: Moves, specifier: string): Resolution {
  const parts = splitSpecifier(specifier);
  const entry = parts && moves[parts.packageName];
  if (!(parts && entry)) return UNCHANGED;
  const { packageName, subpath } = parts;

  if (typeof entry === 'string') {
    return entry === packageName
      ? UNCHANGED
      : { kind: 'whole', specifier: `${entry}${specifier.slice(packageName.length)}` };
  }

  const target = entry[subpath];
  if (target === undefined) return UNCHANGED;
  if (typeof target === 'string') {
    return target === packageName
      ? UNCHANGED
      : { kind: 'whole', specifier: withSubpath(target, subpath) };
  }

  const destinationOf = (name: string): string => {
    const destination = target[name];
    return typeof destination === 'string' && destination !== packageName ? destination : specifier;
  };
  const every = [...new Set(Object.keys(target).map(destinationOf))];
  return { kind: 'by-name', of: destinationOf, every };
}
