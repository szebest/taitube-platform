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
] as const;

const [fullHd, hd, sd] = CANONICAL_LADDER;

export const RENDITIONS = [fullHd.name, hd.name, sd.name] as const;

export type RenditionName = (typeof RENDITIONS)[number];
