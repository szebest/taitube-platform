import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureFixtures } from '../ensure-fixtures';

function fixturesDirWith(...ids: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'ensure-fixtures-'));
  for (const id of ids) {
    writeFileSync(join(dir, `${id}.mp4`), '');
  }
  return dir;
}

describe('ensureFixtures', () => {
  let dir: string;

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it.each([
    { scenario: 'none exist', present: [], missing: ['s2', 's15', 's60', 'not-a-video'] },
    { scenario: 'some exist', present: ['s2', 's60'], missing: ['s15', 'not-a-video'] },
    { scenario: 'all exist', present: ['s2', 's15', 's60', 'not-a-video'], missing: [] },
    {
      scenario: 's2 exists and s2, s15 are asked for',
      present: ['s2'],
      ids: ['s2', 's15'],
      missing: ['s15'],
    },
  ])('generates exactly the missing ids when $scenario', ({ present, ids, missing }) => {
    dir = fixturesDirWith(...present);
    const generate = vi.fn();

    ensureFixtures(dir, generate, ids);

    expect(generate.mock.calls).toEqual(missing.length > 0 ? [[missing]] : []);
  });
});
