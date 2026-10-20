import { z } from 'zod';
import { DimensionSchema } from './values';

const SPACE_INDICES = [
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '8',
  '10',
  '12',
  '16',
  '20',
  '24',
] as const;

const SPACE_GRID_PX = 4;

export const Z_LAYERS = [
  'base',
  'sticky',
  'rail',
  'overlay',
  'modal',
  'popover',
  'toast',
  'tooltip',
] as const;

export type ZLayer = (typeof Z_LAYERS)[number];

export const BREAKPOINTS = ['medium', 'expanded', 'large', 'xlarge'] as const;

export type Breakpoint = (typeof BREAKPOINTS)[number];

const PixelSchema = z.string().regex(/^\d+px$/);

const risesInOrder =
  <K extends string, V>(order: readonly K[], measure: (value: V) => number) =>
  (record: Readonly<Record<K, V>>) => {
    const measures = order.map((key) => measure(record[key]));
    return measures.every((value, index) => index === 0 || value > (measures[index - 1] ?? value));
  };

export const ScaleSchema = z.strictObject({
  space: z
    .record(z.enum(SPACE_INDICES), DimensionSchema)
    .refine(
      (space) =>
        Object.entries(space).every(
          ([index, value]) => value === `${Number(index) * SPACE_GRID_PX}px`
        ),
      'a space step is its Tailwind index times 4 px'
    ),
  z: z
    .record(z.enum(Z_LAYERS), z.int().nonnegative())
    .refine(risesInOrder(Z_LAYERS, Number), 'each layer sits above the one before it'),
  breakpoint: z
    .record(z.enum(BREAKPOINTS), PixelSchema)
    .refine(
      risesInOrder(BREAKPOINTS, Number.parseFloat),
      'each breakpoint starts above the one before it'
    ),
  layout: z.strictObject({
    'content-max': PixelSchema,
    'reading-max': z.string().regex(/^\d+ch$/),
  }),
});

export type Scale = z.output<typeof ScaleSchema>;
