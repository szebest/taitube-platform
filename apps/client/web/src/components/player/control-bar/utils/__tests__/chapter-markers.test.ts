import { chapterAt, chapterMarkers } from '../chapter-markers';

const CHAPTERS = [
  { startMs: 0, title: 'Intro' },
  { startMs: 150_000, title: 'Middle' },
  { startMs: 450_000, title: 'End' },
];

describe('apps/client/web: chapterMarkers', () => {
  it('places each chapter after the first along the seek bar', () => {
    expect(chapterMarkers(CHAPTERS, undefined, 600)).toEqual([
      { startMs: 150_000, title: 'Middle', percent: 25 },
      { startMs: 450_000, title: 'End', percent: 75 },
    ]);
  });

  it('measures a clip from its own start and leaves the chapters outside it out', () => {
    const range = { startMs: 100_000, endMs: 200_000 };

    expect(chapterMarkers(CHAPTERS, range, 600)).toEqual([
      { startMs: 150_000, title: 'Middle', percent: 50 },
    ]);
  });

  it.each([
    { name: 'no chapters', chapters: [], duration: 600 },
    { name: 'a video of unknown length', chapters: CHAPTERS, duration: 0 },
    {
      name: 'chapters past the end',
      chapters: [{ startMs: 700_000, title: 'Late' }],
      duration: 600,
    },
  ])('draws nothing for $name', ({ chapters, duration }) => {
    expect(chapterMarkers(chapters, undefined, duration)).toEqual([]);
  });
});

describe('apps/client/web: chapterAt', () => {
  it.each([
    { time: 0, title: 'Intro' },
    { time: 149.9, title: 'Intro' },
    { time: 150, title: 'Middle' },
    { time: 590, title: 'End' },
  ])('names $title at $time seconds', ({ time, title }) => {
    expect(chapterAt(CHAPTERS, time)?.title).toBe(title);
  });

  it('names nothing before the first chapter', () => {
    expect(chapterAt([{ startMs: 5_000, title: 'Late' }], 1)).toBeUndefined();
  });
});
