import type { DemoOptions, SeedStepReport } from '../types';
import type { Actor, Api } from './api';
import type { RouteIndex } from './openapi-routes';
import type { SeedPorts } from './ports';
import type { UserSpec, VideoSpec, WorldSpec } from './world-types';

export type StepOutcome = Pick<SeedStepReport, 'status' | 'detail'>;

export interface SeededVideo {
  spec: VideoSpec;
  id: string;
  status: string;
  durationMs: number | null;
}

/** What earlier scenarios learned, for the ones after them. */
export interface SeedState {
  channelIds: Map<string, string>;
  categoryIds: Map<string, string>;
  clips: Map<string, string>;
  videos: Map<string, SeededVideo>;
}

export interface ScenarioContext {
  options: DemoOptions;
  world: WorldSpec;
  ports: SeedPorts;
  api: Api;
  routes: RouteIndex;
  state: SeedState;
  log: (line: string) => void;
}

export interface Scenario {
  name: string;
  /** The rest of the run is meaningless without it, so its failure stops the run. */
  essential: boolean;
  /** Needs videos that finished the pipeline, so it waits for the worker or is skipped without one. */
  needsReady: boolean;
  /** `METHOD /path/{param}` the committed contract must list, else the scenario is skipped. */
  requires: readonly string[];
  run(context: ScenarioContext): Promise<StepOutcome>;
}

export function createSeedState(): SeedState {
  return { channelIds: new Map(), categoryIds: new Map(), clips: new Map(), videos: new Map() };
}

export const actorOf = (user: UserSpec): Actor => ({ id: user.id, role: user.tokenRole });

export function userByKind(world: WorldSpec, kind: UserSpec['kind']): UserSpec | undefined {
  return world.users.find((user) => user.kind === kind);
}

export function userById(world: WorldSpec, id: string): UserSpec | undefined {
  return world.users.find((user) => user.id === id);
}

export function readyVideos(context: ScenarioContext): SeededVideo[] {
  return [...context.state.videos.values()].filter((video) => video.status === 'READY');
}
