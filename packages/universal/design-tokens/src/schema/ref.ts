import { z } from 'zod';
import { ColorSchema } from './values';

const KebabSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

export const RefSchema = z.record(KebabSchema, z.record(KebabSchema, ColorSchema));

export type Ref = z.output<typeof RefSchema>;

export type RefKey<R extends Ref> = {
  [Ramp in keyof R & string]: `${Ramp}.${keyof R[Ramp] & (string | number)}`;
}[keyof R & string];

const ALIAS_OPEN = '{ref.';

export const RefAliasSchema = z.templateLiteral([ALIAS_OPEN, KebabSchema, '.', KebabSchema, '}']);

export type RefAlias = z.output<typeof RefAliasSchema>;

export const refAlias = (key: `${string}.${string | number}`): RefAlias => `${ALIAS_OPEN}${key}}`;

export const refStep = (ramps: Ref, alias: RefAlias) => {
  const [ramp = '', step = ''] = alias.slice(ALIAS_OPEN.length, -1).split('.');
  const steps = Object.hasOwn(ramps, ramp) ? ramps[ramp] : undefined;
  return steps !== undefined && Object.hasOwn(steps, step) ? steps[step] : undefined;
};
