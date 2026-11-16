import { asThrowable } from '@vp/errors';
import { fromPromise, isErr } from '@vp/result';
import type { SeedStepReport } from '../types';
import type { Scenario, ScenarioContext, StepOutcome } from './scenario';

function summary(name: string, outcome: StepOutcome): string {
  return `${outcome.status} ${name}: ${outcome.detail}`;
}

function skipReason(scenario: Scenario, context: ScenarioContext): string | null {
  const missing = scenario.requires.find((route) => !context.routes.has(route));
  if (missing) return `needs ${missing} (not in this build)`;
  if (scenario.needsReady && !context.options.withWorker) {
    return 'needs READY videos, and the worker is off';
  }
  return null;
}

/** Runs the scenarios in order, one line each; a failed essential scenario ends the run, any other failure does not. */
export async function runScenarios(
  scenarios: readonly Scenario[],
  context: ScenarioContext
): Promise<SeedStepReport[]> {
  const steps: SeedStepReport[] = [];
  let stoppedBy: string | null = null;

  for (const scenario of scenarios) {
    const reason = stoppedBy ? `stopped, ${stoppedBy} failed` : skipReason(scenario, context);
    const outcome: StepOutcome = reason
      ? { status: 'skipped', detail: reason }
      : await runOne(scenario, context);

    context.log(summary(scenario.name, outcome));
    steps.push({ scenario: scenario.name, ...outcome });
    if (outcome.status === 'failed' && scenario.essential) stoppedBy = scenario.name;
  }
  return steps;
}

async function runOne(scenario: Scenario, context: ScenarioContext): Promise<StepOutcome> {
  const ran = await fromPromise(
    () => scenario.run(context),
    (cause) => asThrowable(cause).message
  );
  return isErr(ran) ? { status: 'failed', detail: `unexpected: ${ran.error}` } : ran.value;
}
