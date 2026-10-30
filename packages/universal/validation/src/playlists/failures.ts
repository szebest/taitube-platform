import { type InvalidField, type LengthBounds, invalidLength } from '../failures';

export type InvalidPlaylistDetails = InvalidField<LengthBounds>;

export function invalidPlaylistField(
  field: 'title' | 'description',
  bounds: LengthBounds
): InvalidPlaylistDetails {
  return invalidLength(field, bounds);
}
