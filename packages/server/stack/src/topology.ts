import { type Result, err, ok } from '@vp/result';
import { z } from 'zod';

const ComposeConfigSchema = z.object({
  services: z.record(
    z.object({
      profiles: z.array(z.string()).default([]),
      depends_on: z.record(z.object({ condition: z.string() })).default({}),
      build: z.unknown().optional(),
    })
  ),
});

export interface Service {
  readonly name: string;
  readonly profiles: readonly string[];
  readonly dependsOn: readonly string[];
  /** Built from this repo rather than pulled: an app, so its profile is one `all` starts. */
  readonly built: boolean;
  /** Some service waits for it to exit 0, so it runs to completion rather than staying up. */
  readonly oneShot: boolean;
}

export type Topology = ReadonlyMap<string, Service>;

/** Reads `docker compose config --format json`, with every profile enabled. */
export function parseTopology(json: string): Topology {
  const { services } = ComposeConfigSchema.parse(JSON.parse(json));
  const awaitedToExit = new Set(
    Object.values(services).flatMap(({ depends_on }) =>
      Object.entries(depends_on)
        .filter(([, { condition }]) => condition === 'service_completed_successfully')
        .map(([name]) => name)
    )
  );
  return new Map(
    Object.entries(services).map(([name, service]) => [
      name,
      {
        name,
        profiles: service.profiles,
        dependsOn: Object.keys(service.depends_on),
        built: service.build !== undefined,
        oneShot: awaitedToExit.has(name),
      },
    ])
  );
}

function appProfiles(topology: Topology): Set<string> {
  return new Set([...topology.values()].filter((s) => s.built).flatMap((s) => s.profiles));
}

function matching(topology: Topology, target: string): Service[] {
  const services = [...topology.values()];
  if (target === 'all') {
    const apps = appProfiles(topology);
    return services.filter((s) => s.profiles.every((profile) => apps.has(profile)));
  }
  const [profile, member] = target.split(':');
  if (member !== undefined) {
    const prefix = `${profile}-${member}`;
    return services.filter(
      (s) =>
        s.profiles.includes(profile as string) &&
        (s.name === prefix || s.name.startsWith(`${prefix}-`))
    );
  }
  return services.filter((s) => s.name === target || s.profiles.includes(target));
}

/**
 * What a list of targets names: nothing is the infrastructure (every service without a profile), `all` is
 * the infrastructure and every app, a profile is its services, `<profile>:<name>` the services of that
 * profile named `<profile>-<name>` or `<profile>-<name>-*`, and anything else one service by name.
 */
export function selectServices(
  topology: Topology,
  targets: readonly string[]
): Result<string[], { unknownTarget: string }> {
  if (targets.length === 0) {
    return ok([...topology.values()].filter((s) => s.profiles.length === 0).map((s) => s.name));
  }
  const selected = new Set<string>();
  for (const target of targets) {
    const found = matching(topology, target);
    if (found.length === 0) return err({ unknownTarget: target });
    for (const service of found) selected.add(service.name);
  }
  return ok([...selected]);
}

/** The services and everything they depend on, in tiers: each tier depends only on the ones before it. */
export function tiers(topology: Topology, names: readonly string[]): string[][] {
  const depth = new Map<string, number>();
  const visit = (name: string): number => {
    const known = depth.get(name);
    if (known !== undefined) return known;
    const service = topology.get(name);
    const own = 1 + Math.max(-1, ...(service?.dependsOn ?? []).map(visit));
    depth.set(name, own);
    return own;
  };
  for (const name of names) visit(name);

  const levels: string[][] = [];
  for (const [name, level] of [...depth].sort(([a], [b]) => a.localeCompare(b))) {
    levels[level] = [...(levels[level] ?? []), name];
  }
  return levels;
}

/** The profiles a set of services needs enabled for compose to start them. */
export function profilesOf(topology: Topology, names: readonly string[]): string[] {
  return [...new Set(names.flatMap((name) => topology.get(name)?.profiles ?? []))].sort();
}
