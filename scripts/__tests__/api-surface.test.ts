import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';
import { SERVER } from '../../tests/architecture/ecmascript-baseline';
import { surfaceOf } from '../api-surface';

const FILES: Record<string, string> = {
  'functions.ts': `
    export function first<T>(items: readonly T[], fallback?: T): T | undefined { return items[0] ?? fallback; }
    export function pick(a: string): string;
    export function pick(a: number): number;
    export function pick(a: string | number): string | number { return a; }
    export const limit = 3;
    export const names: readonly string[] = [];
    const hidden = 1;
    export const shown = { hidden };
  `,
  'types.ts': `
    /** Documented. */
    export interface Options<T> { readonly value: T; label?: string; }
    export type Pair<A, B = A> = readonly [A, B];
    export enum Mode { On = 'on', Off = 'off' }
  `,
  'classes.ts': `
    export class Box<T> {
      static empty = 0;
      readonly value: T;
      private secret = 1;
      protected inner = 2;
      constructor(value: T) { this.value = value; }
      map<U>(f: (v: T) => U): Box<U> { return new Box(f(this.value)); }
    }
  `,
  'merged.ts': `
    export interface Clock { now(): number }
    export const Clock = { now: (): number => 0 };
  `,
  'barrel.ts': `
    export { first as head } from './functions';
    export * as functions from './functions';
    export type { Pair } from './types';
    export { missing } from 'not-installed';
  `,
};

let dir: string;
let program: ts.Program;

const entry = (name: string) => join(dir, name);

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'api-surface-'));
  mkdirSync(dir, { recursive: true });
  for (const [name, text] of Object.entries(FILES)) writeFileSync(entry(name), text);
  program = ts.createProgram(Object.keys(FILES).map(entry), {
    target: SERVER.target,
    lib: [...SERVER.lib],
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    noEmit: true,
    types: [],
  });
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('scripts: api surface', () => {
  it.each([
    {
      shape: 'functions, overloads and constants, sorted, without what is not exported',
      file: 'functions.ts',
      lines: [
        'export function first<T>(items: readonly T[], fallback?: T): T | undefined',
        'export const limit: 3',
        'export const names: readonly string[]',
        'export function pick(a: string): string',
        'export function pick(a: number): number',
        'export const shown: { hidden: number; }',
      ],
    },
    {
      shape: 'interfaces, aliases and enums as declared, without their comments',
      file: 'types.ts',
      lines: [
        "export enum Mode {\n    On = 'on',\n    Off = 'off'\n}",
        'export interface Options<T> {\n    readonly value: T;\n    label?: string;\n}',
        'export type Pair<A, B = A> = readonly [\n    A,\n    B\n];',
      ],
    },
    {
      shape: 'a class with its constructor and static and public members, not the private ones',
      file: 'classes.ts',
      lines: [
        'export class Box<T>',
        '  constructor<T>(value: T): Box<T>',
        '  static empty: number',
        '  map: <U>(f: (v: T) => U) => Box<U>',
        '  value: T',
      ],
    },
    {
      shape: 'a name that is both a type and a value',
      file: 'merged.ts',
      lines: [
        'export interface Clock {\n    now(): number;\n}',
        'export const Clock: { now: () => number; }',
      ],
    },
  ])('lists $shape', ({ file, lines }) => {
    expect(surfaceOf(program, entry(file))).toEqual(lines);
  });

  it('follows renames and namespace re-exports, and marks what it cannot resolve', () => {
    expect(surfaceOf(program, entry('barrel.ts'))).toEqual([
      'export type Pair<A, B = A> = readonly [\n    A,\n    B\n];',
      'export namespace functions',
      '  export function first<T>(items: readonly T[], fallback?: T): T | undefined',
      '  export function pick(a: string): string',
      '  export function pick(a: number): number',
      '  export const limit: 3',
      '  export const names: readonly string[]',
      '  export const shown: { hidden: number; }',
      'export function head<T>(items: readonly T[], fallback?: T): T | undefined',
      'export missing: unresolved',
    ]);
  });

  it('lists nothing for a file that is not a module of the program', () => {
    expect(surfaceOf(program, entry('absent.ts'))).toEqual([]);
  });
});
