import { type Result, andThen, map } from '@kit/result';
import { type InvalidPlaylistDetails, validateSectionTitle } from '@vp/validation';
import {
  type ManagePlaylistFailure,
  type ManagePlaylistInput,
  decidePlaylistAction,
} from './manage-playlist.rule';

export interface AddPlaylistSectionInput extends ManagePlaylistInput {
  readonly title: string;
}

/** A section reshapes the list for everyone, so it takes what a reorder takes. */
export function decidePlaylistSectionAdd(
  input: AddPlaylistSectionInput
): Result<{ title: string }, ManagePlaylistFailure | InvalidPlaylistDetails> {
  return andThen(decidePlaylistAction(input, 'manageItems'), () =>
    map(validateSectionTitle(input.title), (title) => ({ title }))
  );
}
