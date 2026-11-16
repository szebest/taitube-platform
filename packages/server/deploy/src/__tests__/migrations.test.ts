import { migrationFindings, parseNameStatus } from '../migrations';

const DIR = 'packages/server/db/drizzle';
const journal = (...tags: string[]) =>
  JSON.stringify({ entries: tags.map((tag, idx) => ({ idx, tag })) });

describe('parseNameStatus', () => {
  it('reads each status and path, both sides of a rename', () => {
    expect(parseNameStatus(`A\t${DIR}/0001_a.sql\nR100\told.sql\tnew.sql\n\n`)).toEqual([
      { status: 'A', path: `${DIR}/0001_a.sql` },
      { status: 'R', path: 'old.sql' },
      { status: 'R', path: 'new.sql' },
    ]);
  });
});

describe('migrationFindings', () => {
  const same = { base: journal('0000_a'), head: journal('0000_a', '0001_b') };

  it('accepts new migrations, a new snapshot and an appended journal', () => {
    const changes = [
      { status: 'A', path: `${DIR}/0001_b.sql` },
      { status: 'A', path: `${DIR}/meta/0001_snapshot.json` },
      { status: 'M', path: `${DIR}/meta/_journal.json` },
    ];

    expect(migrationFindings(changes, same)).toEqual([]);
  });

  it.each([
    { status: 'M', path: `${DIR}/0000_a.sql`, verb: 'edited' },
    { status: 'D', path: `${DIR}/0000_a.sql`, verb: 'deleted' },
    { status: 'R', path: `${DIR}/0000_a.sql`, verb: 'renamed' },
    { status: 'M', path: `${DIR}/meta/0000_snapshot.json`, verb: 'edited' },
  ])('refuses a shipped file $verb: $path', ({ status, path, verb }) => {
    expect(migrationFindings([{ status, path }], same)).toEqual([
      `${path} was ${verb}: a shipped migration never changes, add a new one`,
    ]);
  });

  it.each([
    { scenario: 'an entry rewritten', head: journal('0000_z', '0001_b') },
    { scenario: 'an entry dropped', head: journal('0001_b') },
  ])('refuses a journal with $scenario', ({ head }) => {
    expect(migrationFindings([], { base: journal('0000_a', '0001_b'), head })).toEqual([
      `${DIR}/meta/_journal.json rewrote an existing entry: it may only append`,
    ]);
  });

  it('refuses a journal that is not one', () => {
    expect(migrationFindings([], { base: 'nope', head: journal('0000_a') })).toEqual([
      `${DIR}/meta/_journal.json is not a drizzle journal`,
    ]);
  });

  it('skips the journal when either side is absent', () => {
    expect(migrationFindings([], { base: undefined, head: journal('0000_a') })).toEqual([]);
  });
});
