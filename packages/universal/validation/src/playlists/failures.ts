import { type InvalidField, invalidLength, type LengthBounds } from '../failures';

export type InvalidPlaylistDetails = InvalidField<LengthBounds>;

export function invalidPlaylistField(
  field: 'title' | 'description',
  bounds: LengthBounds
): InvalidPlaylistDetails {
  return invalidLength(field, bounds);
}
