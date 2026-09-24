import { z } from 'zod';

export const RENDITIONS = ['1080p', '720p', '480p'] as const;
export type RenditionName = (typeof RENDITIONS)[number];

export const LadderEntry = z.object({
  name: z.enum(RENDITIONS),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  videoKbps: z.number().int().positive(),
  maxrateKbps: z.number().int().positive(),
  bufsizeKbps: z.number().int().positive(),
  audioKbps: z.number().int().positive(),
  profile: z.enum(['main', 'high']),
  level: z.string(),
});
export type LadderEntry = z.infer<typeof LadderEntry>;

/** SDD §8.1, tallest first: a source shorter than every rung keeps the last one. */
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
] as const satisfies readonly LadderEntry[];
