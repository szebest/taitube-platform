import { OVERSIZED_SOURCES } from './oversized-sources';
import { productionSources, read, shrinkOnly } from './repo-files';

const MAX_LINES = 400;
const MAX_BYTES = 10 * 1024;

function oversized(file: string): boolean {
  const source = read(file);
  return source.split('\n').length > MAX_LINES || Buffer.byteLength(source, 'utf8') > MAX_BYTES;
}

describe('architecture: file length ceiling', () => {
  it('holds every production source under 400 lines and 10 KB', () => {
    const offenders = productionSources().filter(oversized);
    const { unlisted } = shrinkOnly(offenders, OVERSIZED_SOURCES);

    expect(unlisted).toEqual([]);
  });

  it('keeps the exception list shrinking: no entry that already fits', () => {
    const offenders = productionSources().filter(oversized);
    const { stale } = shrinkOnly(offenders, OVERSIZED_SOURCES);

    expect(stale).toEqual([]);
  });
});
