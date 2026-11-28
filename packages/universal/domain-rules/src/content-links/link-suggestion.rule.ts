import { type Result, err, ok } from '@kit/result';
import { LINK_SUGGESTIONS_PER_DAY as LINK_SUGGESTION_LIMIT_PER_DAY } from '@vp/domain';
import {
  type LinkExists,
  type LinkSuggestionLimit,
  linkExists,
  linkSuggestionLimit,
} from './failures';

export interface LinkSuggestionInput {
  /** The viewer already has an open suggestion for this source, target and relation. */
  readonly openDuplicate: boolean;
  readonly suggestedToday: number;
}

export function decideLinkSuggestion(
  input: LinkSuggestionInput
): Result<void, LinkExists | LinkSuggestionLimit> {
  if (input.openDuplicate) return err(linkExists());
  if (input.suggestedToday >= LINK_SUGGESTION_LIMIT_PER_DAY) {
    return err(linkSuggestionLimit(LINK_SUGGESTION_LIMIT_PER_DAY));
  }
  return ok(undefined);
}
