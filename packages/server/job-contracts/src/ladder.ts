interface Rung<Name extends string> {
  readonly name: Name;
  readonly width: number;
  readonly height: number;
  readonly videoKbps: number;
  readonly maxrateKbps: number;
  readonly bufsizeKbps: number;
  readonly audioKbps: number;
  readonly profile: 'main' | 'high';
  readonly level: string;
}

/**
 * Authoritative HLS rendition ladder matching SDD §8.1, tallest first.
 * Bitrates and profiles follow Apple HLS Authoring Specifications.
 */
export const CANONICAL_LADDER = [
  {
    name: '1080p',
    width: 1920,
    height: 1080,
    videoKbps: 5000,
    maxrateKbps: 5350,
    bufsizeKbps: 7500,
    audioKbps: 128,
    profile: 'high',
    level: '4.1',
  },
  {
    name: '720p',
    width: 1280,
    height: 720,
    videoKbps: 2800,
    maxrateKbps: 2996,
    bufsizeKbps: 4200,
    audioKbps: 128,
    profile: 'high',
    level: '3.1',
  },
  {
    name: '480p',
    width: 854,
    height: 480,
    videoKbps: 1400,
    maxrateKbps: 1498,
    bufsizeKbps: 2100,
    audioKbps: 96,
    profile: 'main',
    level: '3.1',
  },
] as const satisfies readonly [Rung<string>, ...Rung<string>[]];

export type RenditionName = (typeof CANONICAL_LADDER)[number]['name'];

export const RENDITIONS = CANONICAL_LADDER.map((rung) => rung.name) as [
  RenditionName,
  ...RenditionName[],
];
