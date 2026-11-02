import { load } from 'js-yaml';
import { type Stat, stat } from '../ci-timings';
import { table } from './markdown';
import type { Run } from './model';

interface WorkflowStep {
  id?: string;
  name?: string;
  uses?: string;
  with?: Record<string, unknown>;
}

interface WorkflowJob {
  name?: string;
  'timeout-minutes'?: number;
  steps?: WorkflowStep[];
}

export interface Budget {
  label: string;
  job: RegExp;
  /** The measured step's name; without one the budget is the whole job's `timeout-minutes`. */
  step?: string;
  seconds: number;
}

const BUDGET_ACTION = './.github/actions/budget';

export const MARGIN = 0.85;

const EXPRESSION = /\$\{\{[^}]*\}\}/;

const literal = (text: string): string => text.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');

function nameMatcher(template: string): RegExp {
  return new RegExp(`^${template.split(EXPRESSION).map(literal).join('.+')}$`);
}

export function budgetsOf(source: string): Budget[] {
  const { jobs } = load(source) as { jobs: Record<string, WorkflowJob> };
  return Object.entries(jobs).flatMap(([key, job]) => {
    const name = job.name ?? key;
    const label = name.replace(new RegExp(EXPRESSION, 'g'), '*');
    const matcher = nameMatcher(name);
    const timeout = job['timeout-minutes'];
    const whole = timeout === undefined ? [] : [{ label, job: matcher, seconds: timeout * 60 }];
    const steps = (job.steps ?? []).flatMap((step) => {
      if (step.uses !== BUDGET_ACTION || typeof step.with?.step !== 'string') return [];
      const measured = job.steps?.find((candidate) => candidate.id === step.with?.step)?.name;
      if (measured === undefined) return [];
      return [
        {
          label: `${label} / ${measured}`,
          job: matcher,
          step: measured,
          seconds: Number(step.with.seconds),
        },
      ];
    });
    return [...whole, ...steps];
  });
}

const elapsed = (from: string | null, to: string | null): number | undefined =>
  from && to ? (Date.parse(to) - Date.parse(from)) / 1000 : undefined;

/** Every successful run of what a budget measures, in seconds, over every attempt. */
export function measured(runs: readonly Run[], budget: Budget): number[] {
  return runs.flatMap((run) =>
    run.jobs
      .filter((job) => budget.job.test(job.name) && job.conclusion === 'success')
      .flatMap((job) => {
        if (budget.step === undefined) return [elapsed(job.started_at, job.completed_at)];
        const step = job.steps.find(
          (candidate) => candidate.name === budget.step && candidate.conclusion === 'success'
        );
        return [elapsed(step?.started_at ?? null, step?.completed_at ?? null)];
      })
      .filter((value): value is number => value !== undefined)
  );
}

export interface MarginRow extends Stat {
  label: string;
  seconds: number;
  near85: number;
  near90: number;
  over: number;
}

export function margins(runs: readonly Run[], budgets: readonly Budget[]): MarginRow[] {
  return budgets.flatMap((budget) => {
    const values = measured(runs, budget);
    if (values.length === 0) return [];
    const atLeast = (fraction: number) =>
      values.filter((value) => value >= fraction * budget.seconds).length;
    return [
      {
        label: budget.label,
        seconds: budget.seconds,
        ...stat(values),
        near85: atLeast(MARGIN),
        near90: atLeast(0.9),
        over: values.filter((value) => value > budget.seconds).length,
      },
    ];
  });
}

export function renderMargins(rows: readonly MarginRow[]): string {
  return table(
    ['Budget', 'Runs', 'Median s', 'p90 s', 'Max s', 'Limit s', '>= 85%', '>= 90%', 'Over'],
    rows.map((row) => [
      row.label,
      row.runs,
      row.median.toFixed(0),
      row.p90.toFixed(0),
      row.max.toFixed(0),
      row.seconds,
      row.near85,
      row.near90,
      row.over,
    ])
  );
}
