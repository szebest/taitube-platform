import { readFileSync } from 'node:fs';
import { en } from '@vp/shared-messages';
import { ROOT } from './repo-files';

/**
 * The shared layer holds only words two consumers render: web and studio, or a client and a server.
 * A key one app alone uses belongs to that app's catalogue, so the other app does not ship it. The
 * consumers are the type-aware scan's (`pnpm scan:message-keys`); a key rendered through a package
 * both apps mount (`@vp/queries`) or a registry both import (`ERROR_COPY`) reaches both.
 */
type Usage = Readonly<Record<string, readonly string[]>>;

const MOUNTED_BY_BOTH = new Set(['@vp/queries', '@vp/shared-messages']);
const CLIENT_APPS = new Set(['@vp/web', '@vp/studio']);
const SERVER_APPS = new Set(['@vp/api', '@vp/worker']);

/** Keys built from a plain string the scan cannot follow, each with the reason it is shared. */
const DYNAMIC: Readonly<Record<string, string>> = {};

function reach(consumers: readonly string[]): Set<string> {
  return new Set(
    consumers.flatMap((consumer) => {
      if (MOUNTED_BY_BOTH.has(consumer)) return [...CLIENT_APPS];
      if (CLIENT_APPS.has(consumer)) return [consumer];
      return SERVER_APPS.has(consumer) ? ['server'] : [];
    })
  );
}

function misplaced(keys: readonly string[], usage: Usage): string[] {
  return keys.filter((key) => DYNAMIC[key] === undefined && reach(usage[key] ?? []).size < 2);
}

function sharedKeys(): string[] {
  return Object.entries(en).flatMap(([namespace, messages]) =>
    Object.keys(messages).map((name) => `${namespace}.${name}`)
  );
}

const usage: Usage = JSON.parse(
  readFileSync(`${ROOT}/tests/architecture/message-key-usage.json`, 'utf8')
);

describe('architecture: the shared layer holds only words two consumers render', () => {
  it.each([
    { scenario: 'a key only web renders', consumers: ['@vp/web'], misplaced: ['ui.planted'] },
    { scenario: 'a key nothing renders', consumers: [], misplaced: ['ui.planted'] },
    {
      scenario: 'a key web and studio render',
      consumers: ['@vp/studio', '@vp/web'],
      misplaced: [],
    },
    {
      scenario: 'a key both apps mount through queries',
      consumers: ['@vp/queries'],
      misplaced: [],
    },
    {
      scenario: 'a key a client and the API render',
      consumers: ['@vp/api', '@vp/web'],
      misplaced: [],
    },
  ])('flags $scenario: $misplaced', ({ consumers, misplaced: expected }) => {
    expect(misplaced(['ui.planted'], { 'ui.planted': consumers })).toEqual(expected);
  });

  it('reads the shared catalogue and the scan it is asserting about', () => {
    expect(sharedKeys().length).toBeGreaterThan(150);
    expect(Object.keys(usage).length).toBeGreaterThan(sharedKeys().length);
  });

  it('finds no shared key with fewer than two consumers', () => {
    expect(misplaced(sharedKeys(), usage)).toEqual([]);
  });
});
