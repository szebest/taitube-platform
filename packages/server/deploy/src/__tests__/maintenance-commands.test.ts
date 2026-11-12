import { expired, migrationsCheck, slug } from '../maintenance-commands';
import { fakeHost } from './host-fixture';

const DIR = 'packages/server/db/drizzle';
const journal = (...tags: string[]) =>
  JSON.stringify({ entries: tags.map((tag, idx) => ({ idx, tag })) });

function gitFor(diff: string, base = journal('0000_a')) {
  return (args: readonly string[]) => {
    if (args[0] === 'merge-base') return 'basesha\n';
    if (args[0] === 'diff') return diff;
    if (args[0] === 'show') return base;
    return undefined;
  };
}

describe('migrationsCheck', () => {
  it('asks for a fetched base when there is no merge base', () => {
    const host = fakeHost('/unused');

    expect(migrationsCheck(host, 'origin/main')).toBe(3);
    expect(host.printed).toEqual([
      'cannot find a merge base with origin/main: fetch it, or pass --base <ref>',
    ]);
  });

  it('passes added migrations and an appended journal', () => {
    const host = fakeHost('/unused', {
      git: gitFor(`A\t${DIR}/0001_b.sql\n`),
      readText: () => journal('0000_a', '0001_b'),
    });

    expect(migrationsCheck(host, 'origin/main')).toBe(0);
    expect(host.printed).toEqual(['migrations are forward-only against origin/main']);
  });

  it('fails an edited migration and names it', () => {
    const host = fakeHost('/unused', {
      git: gitFor(`M\t${DIR}/0000_a.sql\n`),
      readText: () => journal('0000_a'),
    });

    expect(migrationsCheck(host, 'origin/main')).toBe(1);
    expect(host.printed).toEqual([
      `${DIR}/0000_a.sql was edited: a shipped migration never changes, add a new one`,
    ]);
  });
});

describe('slug', () => {
  it.each([
    { ref: 'feat/Add_Player', exit: 0, printed: 'feat-add-player' },
    { ref: undefined, exit: 2, printed: 'preview-slug takes a branch name or a PR reference' },
  ])('turns $ref into $printed', ({ ref, exit, printed }) => {
    const host = fakeHost('/unused');

    expect(slug(host, ref)).toBe(exit);
    expect(host.printed).toEqual([printed]);
  });
});

describe('expired', () => {
  const namespaces = (items: object[]) => JSON.stringify({ items });

  it('lists the namespaces past their expiry', () => {
    const host = fakeHost('/unused', {
      stdin: () =>
        namespaces([
          {
            metadata: {
              name: 'preview-old',
              annotations: { 'vp.dev/expires-at': '2026-11-09T00:00:00Z' },
            },
          },
          {
            metadata: {
              name: 'preview-new',
              annotations: { 'vp.dev/expires-at': '2026-11-12T00:00:00Z' },
            },
          },
          { metadata: { name: 'preview-bare' } },
        ]),
    });

    expect(expired(host)).toBe(0);
    expect(host.printed).toEqual(['preview-bare\npreview-old']);
  });

  it('prints nothing when none expired', () => {
    const host = fakeHost('/unused', { stdin: () => namespaces([]) });

    expect(expired(host)).toBe(0);
    expect(host.printed).toEqual([]);
  });

  it.each([
    { scenario: 'not JSON', stdin: 'nope' },
    { scenario: 'not a namespace list', stdin: '{}' },
  ])('answers usage when stdin is $scenario', ({ stdin }) => {
    const host = fakeHost('/unused', { stdin: () => stdin });

    expect(expired(host)).toBe(2);
  });
});
