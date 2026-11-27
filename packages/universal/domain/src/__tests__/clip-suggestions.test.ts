import { suggestClips } from '../clip-suggestions';
import { fillRetentionCurve } from '../retention';

const curveOf = (viewers: readonly number[]) =>
  fillRetentionCurve(viewers.map((count, step) => ({ percent: step * 5, viewers: count })));

/** 1000 viewers falling 40 per step, except a flat plateau over 40 to 55 percent. */
const plateau = curveOf([
  1000, 960, 920, 880, 840, 800, 760, 720, 680, 680, 680, 680, 640, 600, 560, 520, 480, 440, 400,
  360, 320,
]);

describe('@vp/domain: suggestClips', () => {
  it.each([
    { shape: 'nobody has started the video', curve: curveOf([]), durationMs: 600_000 },
    { shape: 'the video is shorter than a window', curve: plateau, durationMs: 10_000 },
  ])('suggests nothing when $shape', ({ curve, durationMs }) => {
    expect(suggestClips({ curve, durationMs, chapters: [] })).toEqual([]);
  });

  it('puts the first suggestion on the plateau, where nobody left', () => {
    const [best] = suggestClips({ curve: plateau, durationMs: 600_000, chapters: [] })
      .slice()
      .sort((a, b) => a.lostShare - b.lostShare);

    expect(best?.lostShare).toBe(0);
    expect(best?.startMs).toBeGreaterThanOrEqual(240_000);
    expect(best?.endMs).toBeLessThanOrEqual(330_000);
  });

  it('returns at most three windows of 15 to 45 seconds inside the video, none overlapping', () => {
    const durationMs = 600_000;
    const clips = suggestClips({ curve: plateau, durationMs, chapters: [] });

    expect(clips.length).toBeLessThanOrEqual(3);
    for (const [index, clip] of clips.entries()) {
      expect(clip.endMs - clip.startMs).toBeGreaterThanOrEqual(15_000);
      expect(clip.endMs - clip.startMs).toBeLessThanOrEqual(45_000);
      expect(clip.startMs).toBeGreaterThanOrEqual(0);
      expect(clip.endMs).toBeLessThanOrEqual(durationMs);
      expect(clip.startMs).toBeGreaterThanOrEqual(clips[index - 1]?.endMs ?? 0);
    }
  });

  it('names the chapter each window starts in', () => {
    const chapters = [
      { startMs: 0, title: 'Intro' },
      { startMs: 200_000, title: 'The good part' },
      { startMs: 400_000, title: 'Outro' },
    ];
    const clips = suggestClips({ curve: plateau, durationMs: 600_000, chapters });
    const onPlateau = clips.find(({ lostShare }) => lostShare === 0);

    expect(onPlateau?.chapterTitle).toBe('The good part');
  });

  it('is deterministic', () => {
    const input = { curve: plateau, durationMs: 600_000, chapters: [] };

    expect(suggestClips(input)).toEqual(suggestClips(input));
  });
});
