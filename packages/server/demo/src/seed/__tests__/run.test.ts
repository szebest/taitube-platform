import { ALL_ROUTES } from '../openapi-routes';
import { runScenarios } from '../run';
import type { Scenario, ScenarioContext } from '../scenario';
import { SMALL } from './fake-seed';

function contextWith(overrides: Partial<ScenarioContext> = {}) {
  const lines: string[] = [];
  const context = {
    options: SMALL,
    routes: ALL_ROUTES,
    log: (line: string) => lines.push(line),
    ...overrides,
  } as ScenarioContext;
  return { context, lines };
}

const scenario = (overrides: Partial<Scenario>): Scenario => ({
  name: 'a',
  essential: false,
  needsReady: false,
  requires: [],
  run: async () => ({ status: 'done', detail: 'ok' }),
  ...overrides,
});

describe('seed/run: runScenarios', () => {
  it('runs in order and logs one line per step', async () => {
    const { context, lines } = contextWith();

    const steps = await runScenarios([scenario({ name: 'a' }), scenario({ name: 'b' })], context);

    expect(steps.map((step) => step.scenario)).toEqual(['a', 'b']);
    expect(lines).toEqual(['done a: ok', 'done b: ok']);
  });

  it('skips a scenario whose route is not in the contract without running it', async () => {
    const run = vi.fn();
    const { context, lines } = contextWith({ routes: { has: () => false } });

    const steps = await runScenarios([scenario({ requires: ['POST /v1/x'], run })], context);

    expect(run).not.toHaveBeenCalled();
    expect(steps[0]).toEqual({
      scenario: 'a',
      status: 'skipped',
      detail: 'needs POST /v1/x (not in this build)',
    });
    expect(lines).toEqual(['skipped a: needs POST /v1/x (not in this build)']);
  });

  it('skips what needs READY videos when the worker is off', async () => {
    const { context } = contextWith({ options: { ...SMALL, withWorker: false } });

    const steps = await runScenarios([scenario({ needsReady: true })], context);

    expect(steps[0]?.status).toBe('skipped');
  });

  it('turns a throw into a failed step and carries on with the next one', async () => {
    const { context } = contextWith();

    const steps = await runScenarios(
      [
        scenario({
          name: 'a',
          run: async () => {
            throw new Error('boom');
          },
        }),
        scenario({ name: 'b' }),
      ],
      context
    );

    expect(steps.map((step) => step.status)).toEqual(['failed', 'done']);
    expect(steps[0]?.detail).toBe('unexpected: boom');
  });

  it('stops after an essential step fails', async () => {
    const { context } = contextWith();

    const steps = await runScenarios(
      [
        scenario({
          name: 'a',
          essential: true,
          run: async () => ({ status: 'failed', detail: 'no' }),
        }),
        scenario({ name: 'b' }),
      ],
      context
    );

    expect(steps[1]).toEqual({ scenario: 'b', status: 'skipped', detail: 'stopped, a failed' });
  });
});
