import type { MoreBranches } from '@kit/intl';

/**
 * The copy a collapsed `{x:list}` ends on, `{?}` the hidden count. English leaves "and" to the
 * list pattern, so "A, B, and 2 more" reads `2 more`.
 */
export const listMore = {
  en: { one: '{?} more', other: '{?} more' },
  pl: {
    one: '{?} inny',
    few: '{?} inne',
    many: '{?} innych',
    other: '{?} innego',
  },
} as const satisfies Record<string, MoreBranches>;
