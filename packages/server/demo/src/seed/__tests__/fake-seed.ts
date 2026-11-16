import type { DemoOptions } from '../../types';
import { createApi } from '../api';
import { seedDemo } from '../index';
import { ALL_ROUTES } from '../openapi-routes';
import { runScenarios } from '../run';
import { type Scenario, createSeedState } from '../scenario';
import { categories } from '../scenarios/categories';
import { channels } from '../scenarios/channels';
import { identities } from '../scenarios/identities';
import { media } from '../scenarios/media';
import { videos } from '../scenarios/videos';
import { buildWorld } from '../world';
import { type FakeApi, createFakeApi } from './fake-api';
import { type FakePortOptions, type FakePorts, createFakePorts } from './fake-ports';

export const SMALL: DemoOptions = {
  profile: 'minimal',
  videos: 6,
  users: 8,
  channels: 3,
  seed: 1729,
  withWorker: true,
  apiUrl: 'http://api.test',
  workDir: '/work',
  dryRun: false,
};

/** One seed run against the fake API; call it twice with the same `api` to see what a re-run adds. */
export async function runSeed(
  api: FakeApi = createFakeApi(),
  options: Partial<DemoOptions> = {},
  ports: FakePortOptions = {}
) {
  const lines: string[] = [];
  const fakePorts = createFakePorts({ ...ports, fetch: api.fetch, upload: undefined });
  fakePorts.uploader = api.uploader;
  const report = await seedDemo(
    { ...SMALL, ...options },
    { log: (line) => lines.push(line) },
    fakePorts
  );
  return { report, lines, ports: fakePorts };
}

export { createFakeApi };

const PREREQUISITES = [identities, categories, channels, media, videos];

/** Runs the scenarios that make a world (identities to videos) and then the ones under test. */
export async function runScenariosOnFake(
  scenarios: readonly Scenario[],
  api: FakeApi = createFakeApi(),
  options: Partial<DemoOptions> = {},
  ports: FakePortOptions = {},
  shared?: FakePorts
) {
  const lines: string[] = [];
  const fakePorts = shared ?? createFakePorts({ ...ports, fetch: api.fetch });
  fakePorts.fetch = api.fetch;
  fakePorts.uploader = api.uploader;
  const merged = { ...SMALL, ...options };
  const steps = await runScenarios(
    [...PREREQUISITES, ...scenarios.filter((s) => !PREREQUISITES.includes(s))],
    {
      options: merged,
      world: buildWorld(merged),
      ports: fakePorts,
      api: createApi(fakePorts, merged.apiUrl),
      routes: ALL_ROUTES,
      state: createSeedState(),
      log: (line) => lines.push(line),
    }
  );
  const own = scenarios.flatMap((s) => steps.filter((step) => step.scenario === s.name));
  return { steps: own, all: steps, lines, ports: fakePorts, api };
}

/** The step a scenario reports on a first run and on a second run against the same fake API. */
export async function runTwice(scenario: Scenario, options: Partial<DemoOptions> = {}) {
  const api = createFakeApi();
  const shared = createFakePorts();
  const first = await runScenariosOnFake([scenario], api, options, {}, shared);
  const second = await runScenariosOnFake([scenario], api, options, {}, shared);
  return { first: first.steps[0], second: second.steps[0], api };
}
