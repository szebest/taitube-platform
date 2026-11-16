import { type Result, err, ok, parseJson } from '@vp/result';
import { z } from 'zod';
import type { DemoHost } from './host';
import type { DemoRunOptions } from './options';
import type { SeedReport } from './types';

const SeedReportSchema = z.object({
  steps: z.array(
    z.object({
      scenario: z.string(),
      status: z.enum(['done', 'skipped', 'failed']),
      detail: z.string(),
    })
  ),
});

const StateSchema = z.object({
  version: z.literal(1),
  startedAt: z.string(),
  updatedAt: z.string(),
  options: z.record(z.string(), z.unknown()),
  seed: SeedReportSchema.optional(),
});

export type DemoState = z.infer<typeof StateSchema>;

export function statePath(options: DemoRunOptions): string {
  return `${options.workDir}/state.json`;
}

export function mediaPath(options: DemoRunOptions): string {
  return `${options.workDir}/media`;
}

export function readState(
  host: DemoHost,
  options: DemoRunOptions
): Result<DemoState | undefined, string> {
  const text = host.readFile(statePath(options));
  if (text === undefined) return ok(undefined);
  const json = parseJson(text);
  if (!json.ok) return err(`${statePath(options)} is not JSON; delete it or run pnpm demo reset`);
  const parsed = StateSchema.safeParse(json.value);
  if (!parsed.success) return err(`${statePath(options)} is from another version; delete it`);
  return ok(parsed.data);
}

export function writeState(
  host: DemoHost,
  options: DemoRunOptions,
  previous: DemoState | undefined,
  seed: SeedReport | undefined
): DemoState {
  const at = new Date(host.now()).toISOString();
  const report = seed ?? previous?.seed;
  const state: DemoState = {
    version: 1,
    startedAt: previous?.startedAt ?? at,
    updatedAt: at,
    options: { ...options },
    ...(report ? { seed: { steps: [...report.steps] } } : {}),
  };
  host.writeFile(statePath(options), `${JSON.stringify(state, null, 2)}\n`);
  return state;
}

export function summarizeSeed(report: SeedReport): string {
  const count = (status: string) => report.steps.filter((s) => s.status === status).length;
  return `${count('done')} done, ${count('skipped')} skipped, ${count('failed')} failed of ${report.steps.length} seed steps`;
}
