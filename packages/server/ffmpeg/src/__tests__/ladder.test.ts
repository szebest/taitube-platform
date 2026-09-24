import { CANONICAL_LADDER } from '@vp/job-contracts';
import { selectLadder } from '../ladder';

function namesFor(effectiveHeight: number): string[] {
  return selectLadder({ effectiveWidth: 0, effectiveHeight }).map((rung) => rung.name);
}

describe('ffmpeg: ladder selection', () => {
  it.each([
    { height: 2160, names: ['1080p', '720p', '480p'] },
    { height: 1080, names: ['1080p', '720p', '480p'] },
    { height: 720, names: ['720p', '480p'] },
    { height: 480, names: ['480p'] },
    { height: 360, names: ['480p'] },
  ])('encodes a $height-line source as $names', ({ height, names }) => {
    expect(namesFor(height)).toEqual(names);
  });

  it('hands out copies, so a caller cannot change the canonical ladder', () => {
    const [first] = selectLadder({ effectiveWidth: 1920, effectiveHeight: 1080 });
    if (first) first.height = 1;

    expect(CANONICAL_LADDER[0]?.height).toBe(1080);
  });
});
