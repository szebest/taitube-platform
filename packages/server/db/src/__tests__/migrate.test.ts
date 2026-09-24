import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { migrationsHash } from '../migrate';

describe('db: migrationsHash', () => {
  let folder: string;

  beforeEach(() => {
    folder = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-migrations-'));
    fs.mkdirSync(path.join(folder, 'meta'));
    fs.writeFileSync(path.join(folder, '0000_init.sql'), 'CREATE TABLE a ();');
    fs.writeFileSync(path.join(folder, 'meta', '_journal.json'), '{"entries":[]}');
  });

  afterEach(() => {
    fs.rmSync(folder, { recursive: true, force: true });
  });

  it('reads the same folder to the same digest', () => {
    expect(migrationsHash(folder)).toBe(migrationsHash(folder));
  });

  it.each([
    { change: 'a changed migration', file: '0000_init.sql', content: 'CREATE TABLE b ();' },
    { change: 'a new migration', file: '0001_next.sql', content: 'ALTER TABLE a ADD c int;' },
    { change: 'a changed journal', file: 'meta/_journal.json', content: '{"entries":[1]}' },
  ])('reads $change as work left to apply', ({ file, content }) => {
    const before = migrationsHash(folder);

    fs.writeFileSync(path.join(folder, file), content);

    expect(migrationsHash(folder)).not.toBe(before);
  });

  it('ignores a file that is not a migration', () => {
    const before = migrationsHash(folder);

    fs.writeFileSync(path.join(folder, 'README.md'), 'notes');

    expect(migrationsHash(folder)).toBe(before);
  });
});
