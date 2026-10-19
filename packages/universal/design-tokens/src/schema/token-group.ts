import type { ZodType } from 'zod';
import { AmbientSchema } from './ambient';
import { BorderSchema } from './border';
import { FontSizeSchema } from './font-size';
import { MotionSchema } from './motion';
import { RadiusSchema } from './radius';
import { ShadowSchema } from './shadow';
import { SizingSchema } from './sizing';
import { SpacingSchema } from './spacing';
import { TypographySchema } from './typography';

interface TokenGroupDefinition {
  readonly path: string;
  readonly schema: ZodType;
}

export const TOKEN_GROUPS = [
  'typography',
  'fontSize',
  'spacing',
  'sizing',
  'radius',
  'border',
  'shadow',
  'ambient',
  'motion',
] as const;

export type TokenGroup = (typeof TOKEN_GROUPS)[number];

export const tokenGroups = {
  typography: { path: 'typography', schema: TypographySchema },
  fontSize: { path: 'font-size', schema: FontSizeSchema },
  spacing: { path: 'spacing', schema: SpacingSchema },
  sizing: { path: 'sizing', schema: SizingSchema },
  radius: { path: 'radius', schema: RadiusSchema },
  border: { path: 'border', schema: BorderSchema },
  shadow: { path: 'shadow', schema: ShadowSchema },
  ambient: { path: 'ambient', schema: AmbientSchema },
  motion: { path: 'motion', schema: MotionSchema },
} as const satisfies Record<TokenGroup, TokenGroupDefinition>;
