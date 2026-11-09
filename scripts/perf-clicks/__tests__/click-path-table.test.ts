import { renderClickPathTable } from '../click-path-table';
import type { ClickPathSummary } from '../summarize-click-path';

const summary = (overrides: Partial<ClickPathSummary> = {}): ClickPathSummary => ({
  cls: 0.095,
  largestShift: { value: 0.094, source: 'install-prompt' },
  longTasks: { count: 2, ms: 128 },
  inpMs: 216,
  keystrokeMs: 216,
  ...overrides,
});

describe('renderClickPathTable', () => {
  it('prints one run as a value column', () => {
    expect(renderClickPathTable(summary()).split('\n')).toEqual([
      '| Metric | Value |',
      '| --- | --- |',
      '| CLS | 0.095 |',
      '| Largest shift source | install-prompt |',
      '| Long tasks | 2 |',
      '| Long task time (ms) | 128 |',
      '| Worst interaction (ms) | 216 |',
      '| Palette keystroke (ms) | 216 |',
    ]);
  });

  it('prints the baseline beside the run, with a dash for a page that never shifted', () => {
    const table = renderClickPathTable(
      summary({ cls: 0.01, largestShift: null, keystrokeMs: 80 }),
      summary()
    );

    expect(table).toContain('| Metric | Before | After |');
    expect(table).toContain('| CLS | 0.095 | 0.010 |');
    expect(table).toContain('| Largest shift source | install-prompt | - |');
    expect(table).toContain('| Palette keystroke (ms) | 216 | 80 |');
  });
});
