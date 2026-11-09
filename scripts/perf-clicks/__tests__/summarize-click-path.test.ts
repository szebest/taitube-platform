import type { PageHealth } from '../page-health';
import { summarizeClickPath } from '../summarize-click-path';

const health = (overrides: Partial<PageHealth> = {}): PageHealth => ({
  cls: 0,
  shifts: [],
  longTasks: { count: 0, ms: 0 },
  interactions: [],
  ...overrides,
});

describe('summarizeClickPath', () => {
  it('names the largest shift and rounds the score', () => {
    const summary = summarizeClickPath(
      health({
        cls: 0.0945123,
        shifts: [
          { value: 0.0005, source: 'badge' },
          { value: 0.094, source: 'install-prompt' },
        ],
      })
    );

    expect(summary).toMatchObject({
      cls: 0.0945,
      largestShift: { value: 0.094, source: 'install-prompt' },
    });
  });

  it('has no largest shift on a page that never shifted', () => {
    expect(summarizeClickPath(health()).largestShift).toBeNull();
  });

  it('rounds the long task time to whole milliseconds', () => {
    expect(summarizeClickPath(health({ longTasks: { count: 2, ms: 127.6 } })).longTasks).toEqual({
      count: 2,
      ms: 128,
    });
  });

  it('reports the worst interaction and the median keystroke typed in the palette', () => {
    const summary = summarizeClickPath(
      health({
        interactions: [
          { type: 'pointerup', target: 'video-card', duration: 400 },
          { type: 'keydown', target: 'command-palette-input', duration: 200 },
          { type: 'keydown', target: 'command-palette-input', duration: 100 },
          { type: 'keydown', target: 'command-palette-input', duration: 300 },
          { type: 'keydown', target: 'input', duration: 900 },
        ],
      })
    );

    expect(summary).toMatchObject({ inpMs: 900, keystrokeMs: 200 });
  });

  it('has zero numbers for a path with no interaction', () => {
    expect(summarizeClickPath(health())).toMatchObject({ inpMs: 0, keystrokeMs: 0 });
  });
});
