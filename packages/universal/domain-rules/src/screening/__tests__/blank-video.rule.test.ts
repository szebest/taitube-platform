import { screenBlankVideo } from '../blank-video.rule';
import { THRESHOLDS } from './thresholds';

const frame = (hash: bigint, luma = 10) => ({ hash, luma });
const frames = (count: number, make: (index: number) => ReturnType<typeof frame>) =>
  Array.from({ length: count }, (_, index) => make(index));

describe('@vp/domain-rules: screenBlankVideo', () => {
  it.each([
    { name: 'no frames', input: [], score: null },
    { name: 'identical frames', input: frames(20, () => frame(0xffn)), score: 1 },
    {
      name: 'frames a flip or two apart',
      input: frames(20, (i) => frame(i % 2 === 0 ? 0xffn : 0xfcn)),
      score: 1,
    },
    {
      name: 'a share exactly at the bar',
      input: frames(20, (i) => frame(i < 19 ? 0xffn : 0xffffn)),
      score: 0.95,
    },
    {
      name: 'a share just under the bar',
      input: frames(20, (i) => frame(i < 18 ? 0xffn : 0xffffn)),
      score: null,
    },
    {
      name: 'a picture that holds but fades',
      input: frames(20, (i) => frame(0xffn, 10 + i * 2)),
      score: null,
    },
    {
      name: 'a changing picture',
      input: frames(20, (i) => frame(BigInt(i) * 0x0101010101010101n)),
      score: null,
    },
  ])('scores $name as $score', ({ input, score }) => {
    const finding = screenBlankVideo(input, THRESHOLDS);

    if (score === null) expect(finding).toBeNull();
    else expect(finding).toMatchObject({ reason: 'BLANK', score });
  });

  it('keeps the counts as evidence', () => {
    expect(
      screenBlankVideo(
        frames(4, () => frame(0n)),
        THRESHOLDS
      )?.evidence
    ).toEqual({
      frames: 4,
      matching: 4,
    });
  });
});
