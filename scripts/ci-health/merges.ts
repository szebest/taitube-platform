import { share, table } from './markdown';
import type { Merge } from './model';

export type Trace =
  | 'green'
  | 'not checked'
  | 'inherited from a red PR'
  | 'landed behind main'
  | 'main only';

/** Why main's first run of a merge was not green, judged against the PR's last run and its base. */
export function trace(merge: Merge): Trace {
  if (merge.mainRun === 'success') return 'green';
  if (merge.mainRun !== 'failure') return 'not checked';
  if (merge.lastPrRun !== 'success') return 'inherited from a red PR';
  if (merge.behindBy > 0) return 'landed behind main';
  return 'main only';
}

/** A failure the merge itself caused: a PR merged red or behind main, both of which `strict` and `enforce_admins` block. */
export const tracedToMerge = (merge: Merge): boolean =>
  trace(merge) === 'inherited from a red PR' || trace(merge) === 'landed behind main';

export function renderMerges(merges: readonly Merge[]): string {
  const behind = merges.filter((merge) => merge.behindBy > 0).length;
  const red = merges.filter((merge) => merge.lastPrRun !== 'success').length;
  const traced = merges.filter(tracedToMerge).length;
  return [
    `Of the last ${merges.length} merges: ${share(behind, merges.length)} landed behind main, ${share(red, merges.length)} with a last PR run that was not green, ${traced} main failures traced to a merge.`,
    '',
    table(
      ['Merge', 'Commit', 'Behind main by', 'Last PR run', 'Main first time', 'Traced to'],
      merges.map((merge) => [
        `#${merge.pr}`,
        merge.sha.slice(0, 8),
        merge.behindBy,
        merge.lastPrRun,
        merge.mainRun,
        trace(merge),
      ])
    ),
  ].join('\n');
}
