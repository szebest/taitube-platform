import type { videos } from '@vp/db';
import { toVideoRecord } from '../video.mapper';

type VideoRow = typeof videos.$inferSelect;

const HASH = 'scrypt$salt$hash';

function row(accessPasswordHash: string | null): VideoRow {
  return { id: 'v1', accessPasswordHash } as VideoRow;
}

describe('adapters/postgres/mappers: video', () => {
  it.each([
    ['a video with a password', HASH, true],
    ['a video without one', null, false],
  ])('reads %s as passwordProtected %s', (_name, hash, passwordProtected) => {
    expect(toVideoRecord(row(hash))).toMatchObject({ id: 'v1', passwordProtected });
  });

  it('drops the hash from the record', () => {
    const record = toVideoRecord(row(HASH));

    expect(Object.keys(record)).not.toContain('accessPasswordHash');
    expect(JSON.stringify(record)).not.toContain(HASH);
  });
});
