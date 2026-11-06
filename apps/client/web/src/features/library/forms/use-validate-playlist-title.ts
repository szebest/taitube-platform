import { useT } from '@vp/intl-react';
import { isErr } from '@vp/result';
import { validatePlaylistDescription, validatePlaylistTitle } from '@vp/validation';

/** The title field's validator: the message when the title is not one the server takes. */
export function useValidatePlaylistTitle() {
  const { tOr } = useT();

  return ({ value }: { value: string }) =>
    isErr(validatePlaylistTitle(value)) ? tOr('library.playlistTitleInvalid', {}, '') : undefined;
}

export function useValidatePlaylistDescription() {
  const { tOr } = useT();

  return ({ value }: { value: string }) =>
    isErr(validatePlaylistDescription(value))
      ? tOr('library.playlistDescriptionInvalid', {}, '')
      : undefined;
}
