import { isErr, isOk } from '@kit/result';
import { ErrorCodes } from '@vp/errors';
import { decideLinkSuggestion } from '../link-suggestion.rule';

describe('@vp/domain-rules: decideLinkSuggestion', () => {
  it('accepts the 10th suggestion of the day', () => {
    expect(isOk(decideLinkSuggestion({ openDuplicate: false, suggestedToday: 9 }))).toBe(true);
  });

  it.each([
    {
      scenario: 'an open duplicate',
      openDuplicate: true,
      suggestedToday: 0,
      code: ErrorCodes.LINK_EXISTS,
    },
    {
      scenario: 'the 11th of the day',
      openDuplicate: false,
      suggestedToday: 10,
      code: ErrorCodes.LINK_SUGGESTION_LIMIT,
    },
  ])('refuses $scenario', ({ openDuplicate, suggestedToday, code }) => {
    const result = decideLinkSuggestion({ openDuplicate, suggestedToday });
    expect(isErr(result) && result.error.code).toBe(code);
  });
});
