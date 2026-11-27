import type { LengthBounds } from '@kit/validation';
import { type InvalidField, invalidLength } from '../field-failures';

export type InvalidPlaylistDetails = InvalidField<LengthBounds>;

export function invalidPlaylistField(
  field: 'title' | 'description',
  bounds: LengthBounds
): InvalidPlaylistDetails {
  return invalidLength(field, bounds);
}
