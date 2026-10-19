import { APPEARANCE_SETTINGS } from '@vp/domain/settings';
import { type ZodType, z } from 'zod';
import { ROLES } from './roles';
import { PreferenceIdSchema, type TokenGroup, tokenSetSchema } from './token-group';
import { ColorSchema } from './values';

export const MODE_OPTIONS = APPEARANCE_SETTINGS.mode.options;

export type ModeOption = (typeof MODE_OPTIONS)[number];

export const CONTRAST_OPTIONS = APPEARANCE_SETTINGS.contrast.options;

export type ContrastOption = (typeof CONTRAST_OPTIONS)[number];

const RoleColorsSchema = z.record(z.enum(ROLES), ColorSchema);

const ThemeColorSchema = z.strictObject({
  dark: RoleColorsSchema,
  light: RoleColorsSchema,
  oled: z.partialRecord(z.enum(ROLES), ColorSchema),
} satisfies Record<Exclude<ModeOption, 'system'>, ZodType>);

const CATEGORICAL_SERIES = 6;

const RAMP_STEPS = 5;

const DatavizSchema = z.strictObject({
  'categorical-dark': z.array(ColorSchema).length(CATEGORICAL_SERIES),
  'categorical-light': z.array(ColorSchema).length(CATEGORICAL_SERIES),
  sequential: z.array(ColorSchema).length(RAMP_STEPS),
  diverging: z.array(ColorSchema).length(RAMP_STEPS),
});

export const ThemeSchema = z.strictObject({
  id: PreferenceIdSchema,
  name: z.string().min(1),
  color: ThemeColorSchema,
  dataviz: DatavizSchema,
  defaults: z.strictObject({
    typography: tokenSetSchema('typography'),
    fontSize: tokenSetSchema('fontSize'),
    spacing: tokenSetSchema('spacing'),
    sizing: tokenSetSchema('sizing'),
    radius: tokenSetSchema('radius'),
    border: tokenSetSchema('border'),
    shadow: tokenSetSchema('shadow'),
    ambient: tokenSetSchema('ambient'),
    motion: tokenSetSchema('motion'),
  } satisfies Record<TokenGroup, ZodType>),
});

export type Theme = z.output<typeof ThemeSchema>;
