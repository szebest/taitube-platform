import { isErr } from '@vp/result';
import type { DemoOptions, SeedHost, SeedReport, SeedStepReport } from '../types';
import { createApi } from './api';
import { describeFailure } from './failure';
import { createNodePorts } from './node-ports';
import { ALL_ROUTES } from './openapi-routes';
import type { SeedPorts } from './ports';
import { runScenarios } from './run';
import { createSeedState } from './scenario';
import { SCENARIOS } from './scenarios';
import { buildWorld } from './world';

/**
 * Seeds the same demo world every time `options.seed` is the same, through the public API and the real
 * pipeline; running it again finds what is there and adds nothing. `ports` is for tests.
 */
export async function seedDemo(
  options: DemoOptions,
  host: SeedHost,
  ports: SeedPorts = createNodePorts(options, host)
): Promise<SeedReport> {
  if (host.environment === 'production') {
    const detail = 'refuses NODE_ENV=production: the seed is demo data';
    host.log(`failed guard: ${detail}`);
    return { steps: [{ scenario: 'guard', status: 'failed', detail }] };
  }

  const world = buildWorld(options);
  host.log(
    `world for seed ${options.seed}: ${world.users.length} users, ${world.videos.length} videos, ${world.comments.length} comment threads`
  );

  if (options.dryRun) {
    const steps: SeedStepReport[] = SCENARIOS.map(({ name }) => ({
      scenario: name,
      status: 'skipped',
      detail: 'dry run',
    }));
    for (const step of steps) host.log(`skipped ${step.scenario}: dry run`);
    return { steps };
  }

  const loaded = await ports.contractRoutes();
  if (isErr(loaded)) host.log(`  ${describeFailure(loaded.error)}; trying every route`);

  const steps = await runScenarios(SCENARIOS, {
    options,
    world,
    ports,
    api: createApi(ports, options.apiUrl),
    routes: isErr(loaded) ? ALL_ROUTES : loaded.value,
    state: createSeedState(),
    log: host.log,
  });
  return { steps };
}
