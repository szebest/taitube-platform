import type { ClickPathSummary } from './summarize-click-path';

const ROWS: ReadonlyArray<readonly [string, (summary: ClickPathSummary) => string]> = [
  ['CLS', ({ cls }) => cls.toFixed(3)],
  ['Largest shift source', ({ largestShift }) => largestShift?.source ?? '-'],
  ['Long tasks', ({ longTasks }) => String(longTasks.count)],
  ['Long task time (ms)', ({ longTasks }) => String(longTasks.ms)],
  ['Worst interaction (ms)', ({ inpMs }) => String(Math.round(inpMs))],
  ['Palette keystroke (ms)', ({ keystrokeMs }) => String(Math.round(keystrokeMs))],
];

const row = (cells: readonly string[]) => `| ${cells.join(' | ')} |`;

/** A markdown table of the click path's numbers, with the run it is measured against in a column of its own. */
export function renderClickPathTable(
  summary: ClickPathSummary,
  baseline?: ClickPathSummary
): string {
  const header = baseline ? ['Metric', 'Before', 'After'] : ['Metric', 'Value'];
  return [
    row(header),
    row(header.map(() => '---')),
    ...ROWS.map(([name, read]) =>
      row(baseline ? [name, read(baseline), read(summary)] : [name, read(summary)])
    ),
  ].join('\n');
}
