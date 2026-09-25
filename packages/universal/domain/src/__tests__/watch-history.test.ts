import { clampProgress, isWatchCompleted, resumeAtSeconds, watchedPercent } from '../watch-history';

describe('@vp/domain: watch history', () => {
  it.each([
    { progressSeconds: 91, durationSeconds: 100, completed: false, percent: 91, resume: 91 },
    { progressSeconds: 92, durationSeconds: 100, completed: true, percent: 92, resume: 0 },
    { progressSeconds: 0, durationSeconds: 100, completed: false, percent: 0, resume: 0 },
    { progressSeconds: 45, durationSeconds: 600, completed: false, percent: 7, resume: 45 },
    { progressSeconds: 600, durationSeconds: 600, completed: true, percent: 100, resume: 0 },
  ])(
    'reads $progressSeconds of $durationSeconds s as $percent % watched, completed $completed',
    ({ completed, percent, resume, ...progress }) => {
      expect(isWatchCompleted(progress)).toBe(completed);
      expect(watchedPercent(progress)).toBe(percent);
      expect(resumeAtSeconds(progress)).toBe(resume);
    }
  );

  it.each([
    { scenario: 'a playhead past the end', progress: 130, expected: 120 },
    { scenario: 'a playhead inside the video', progress: 60, expected: 60 },
  ])('keeps $scenario within the duration', ({ progress, expected }) => {
    expect(clampProgress(progress, 120)).toBe(expected);
  });
});
