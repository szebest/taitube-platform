import type { TranscriptCue } from '../captions';
import { suggestChapters } from '../chapter-suggestions';

function cue(index: number, startMs: number, text: string, lengthMs = 4_000): TranscriptCue {
  return { index, startMs, endMs: startMs + lengthMs, text };
}

function speak(text: string, fromMs: number, toMs: number, indexFrom = 0): TranscriptCue[] {
  const cues: TranscriptCue[] = [];
  for (let at = fromMs, index = indexFrom; at < toMs; at += 5_000, index++) {
    cues.push(cue(index, at, text, 4_800));
  }
  return cues;
}

const cooking = 'chopping onions garlic simmering sauce tomatoes';
const travel = 'airport luggage passport boarding flight terminal';
const DURATION = 240_000;

function twoTopics(gapMs = 0): TranscriptCue[] {
  return [...speak(cooking, 0, 120_000 - gapMs), ...speak(travel, 120_000, DURATION, 100)];
}

describe('@vp/domain: suggestChapters', () => {
  it('opens with a chapter at zero and cuts where the topic changes', () => {
    const chapters = suggestChapters(twoTopics(), { durationMs: DURATION, language: 'en' });

    expect(chapters.map(({ startMs }) => startMs)).toEqual([0, 120_000]);
  });

  it('titles a chapter with its three heaviest terms', () => {
    const [first, second] = suggestChapters(twoTopics(), { durationMs: DURATION, language: 'en' });

    expect(first?.title.split(', ')).toHaveLength(3);
    expect(first?.title.toLowerCase()).toMatch(/onions|garlic|chopping|simmering|sauce|tomatoes/);
    expect(second?.title.toLowerCase()).toMatch(
      /airport|luggage|passport|boarding|flight|terminal/
    );
  });

  it('moves a boundary to a nearby silence', () => {
    const cues = [...speak(cooking, 0, 115_000), ...speak(travel, 122_000, DURATION, 100)];

    const chapters = suggestChapters(cues, { durationMs: DURATION, language: 'en' });

    expect(chapters.map(({ startMs }) => startMs)).toEqual([0, 122_000]);
  });

  it('cuts at pauses only when the language has no stop list', () => {
    const cues = [...speak(cooking, 0, 115_000), ...speak(travel, 122_000, DURATION, 100)];

    const chapters = suggestChapters(cues, { durationMs: DURATION, language: 'pl' });

    expect(chapters.map(({ startMs }) => startMs)).toEqual([0, 122_000]);
  });

  it('keeps boundaries ninety seconds apart', () => {
    const cues = [
      ...speak(cooking, 0, 40_000),
      ...speak(travel, 40_000, 80_000, 50),
      ...speak(cooking, 80_000, 120_000, 100),
      ...speak(travel, 120_000, DURATION, 150),
    ];

    const starts = suggestChapters(cues, { durationMs: DURATION, language: 'en' }).map(
      ({ startMs }) => startMs
    );

    expect(starts.slice(1).every((start, index) => start - (starts[index] ?? 0) >= 90_000)).toBe(
      true
    );
  });

  it('returns at most twelve chapters', () => {
    const cues = Array.from({ length: 30 }, (_, block) =>
      speak(block % 2 ? cooking : travel, block * 100_000, block * 100_000 + 100_000, block * 30)
    ).flat();

    const chapters = suggestChapters(cues, { durationMs: 3_000_000, language: 'en' });

    expect(chapters.length).toBeLessThanOrEqual(12);
  });

  it('is deterministic', () => {
    const run = () => suggestChapters(twoTopics(), { durationMs: DURATION, language: 'en' });

    expect(run()).toEqual(run());
  });

  it.each([
    { name: 'no cues', cues: [], durationMs: DURATION },
    { name: 'no duration', cues: speak(cooking, 0, 60_000), durationMs: 0 },
  ])('returns nothing for $name', ({ cues, durationMs }) => {
    expect(suggestChapters(cues, { durationMs, language: 'en' })).toEqual([]);
  });
});
