import type { LengthBounds } from '@kit/validation';
import { type InvalidField, invalidField, invalidLength } from '../field-failures';

export interface ItemBounds {
  readonly minItems: number;
  readonly maxItems: number;
}

interface MinimumValue {
  readonly min: number;
}

interface ValueRange {
  readonly min: number;
  readonly max: number;
}

export type InvalidPostPayload =
  | InvalidField<LengthBounds>
  | InvalidField<ItemBounds>
  | InvalidField<MinimumValue>
  | InvalidField<ValueRange>;

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

export function invalidPostOptionCount(bounds: ItemBounds): InvalidPostPayload {
  return invalidField(
    'options',
    `options must hold between ${bounds.minItems} and ${bounds.maxItems} items`,
    bounds
  );
}

export function invalidPostCorrectIndex(optionCount: number): InvalidPostPayload {
  return invalidField('correctIndex', 'correctIndex must point at one of the options', {
    min: 0,
    max: optionCount - 1,
  });
}

export function invalidPostCloseTime(maxDays: number): InvalidPostPayload {
  return invalidField('closesAt', `closesAt must be in the future and within ${maxDays} days`, {
    min: 0,
    max: maxDays,
  });
}

export function invalidPostOptionIndex(optionCount: number): InvalidPostPayload {
  return invalidField('optionIndex', 'optionIndex must point at one of the options', {
    min: 0,
    max: Math.max(optionCount - 1, 0),
  });
}
