import type { LengthBounds } from '@kit/validation';
import { type InvalidField, invalidField, invalidLength } from '../field-failures';

export interface ItemBounds {
  readonly minItems: number;
  readonly maxItems: number;
}

export interface MinimumValue {
  readonly min: number;
}

export type InvalidPostPayload =
  | InvalidField<LengthBounds>
  | InvalidField<ItemBounds>
  | InvalidField<MinimumValue>;

export function invalidPostText(field: string, bounds: LengthBounds): InvalidPostPayload {
  return invalidLength(field, bounds);
}

export function invalidPostImageCount(bounds: ItemBounds): InvalidPostPayload {
  return invalidField(
    'images',
    `images must hold between ${bounds.minItems} and ${bounds.maxItems} items`,
    bounds
  );
}

export function invalidPostStartMs(): InvalidPostPayload {
  return invalidField('startMs', 'startMs must be a whole number of milliseconds, 0 or more', {
    min: 0,
  });
}
