import { APPEARANCE_SETTINGS } from '@vp/domain/settings';
import { type ZodType, z } from 'zod';
import { type Ref, RefAliasSchema, refStep } from './ref';
import { ROLES } from './roles';
import { PreferenceIdSchema, TOKEN_SET_SCHEMAS } from './token-group';
import { ColorSchema, type HexColor } from './values';

export const MODE_OPTIONS = APPEARANCE_SETTINGS.mode.options;

export type ModeOption = (typeof MODE_OPTIONS)[number];

export const CONTRAST_OPTIONS = APPEARANCE_SETTINGS.contrast.options;

export type ContrastOption = (typeof CONTRAST_OPTIONS)[number];

const CATEGORICAL_SERIES = 6;

const RAMP_STEPS = 5;

const themeSchema = <Colour extends ZodType<string, string>>(colour: Colour) =>
  z.strictObject({
    id: PreferenceIdSchema,
    name: z.string().min(1),
    color: z.strictObject({
      dark: z.record(z.enum(ROLES), colour),
      light: z.record(z.enum(ROLES), colour),
      oled: z.partialRecord(z.enum(ROLES), colour),
    } satisfies Record<Exclude<ModeOption, 'system'>, ZodType>),
    dataviz: z.strictObject({
      'categorical-dark': z.array(colour).length(CATEGORICAL_SERIES),
      'categorical-light': z.array(colour).length(CATEGORICAL_SERIES),
      sequential: z.array(colour).length(RAMP_STEPS),
      diverging: z.array(colour).length(RAMP_STEPS),
    }),
    defaults: z.strictObject(TOKEN_SET_SCHEMAS),
  });

export const ThemeSchema = themeSchema(z.union([ColorSchema, RefAliasSchema]));

export type Theme = z.output<typeof ThemeSchema>;

const resolvedColour = (ramps: Ref) =>
  z.union([
    ColorSchema,
    RefAliasSchema.transform((alias, context): HexColor => {
      const step = refStep(ramps, alias);
      if (step === undefined) {
        context.addIssue({ code: 'custom', message: `${alias} names no ref step` });
        return z.NEVER;
      }
      return step;
    }),
  ]);

export const resolvedThemeSchema = (ramps: Ref) => themeSchema(resolvedColour(ramps));

export type ResolvedTheme = z.output<ReturnType<typeof resolvedThemeSchema>>;
