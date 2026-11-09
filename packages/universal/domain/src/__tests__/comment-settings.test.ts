import { DEFAULT_COMMENT_SETTINGS, DISCLOSURE_RULES } from '../comment-settings';

describe('@vp/domain: comment settings defaults', () => {
  it('starts with nothing held, limited or blocked', () => {
    expect(DEFAULT_COMMENT_SETTINGS).toMatchObject({
      reviewMode: 'none',
      blockedWords: [],
      linkAllowlist: [],
      slowModeSeconds: null,
      subscribersOnly: false,
      minAccountAgeDays: 0,
    });
  });

  it.each([
    { rule: 'hide', disclosure: 'silent' },
    { rule: 'remove', disclosure: 'visible' },
    { rule: 'manual_hold', disclosure: 'visible' },
    { rule: 'auto.blocked_words', disclosure: 'silent' },
    { rule: 'auto.links', disclosure: 'visible' },
    { rule: 'auto.review_all', disclosure: 'visible' },
  ])('discloses $rule as $disclosure by default', ({ rule, disclosure }) => {
    expect(DEFAULT_COMMENT_SETTINGS.disclosure).toHaveProperty(rule, disclosure);
  });

  it('has a default for every rule and no other', () => {
    expect(Object.keys(DEFAULT_COMMENT_SETTINGS.disclosure).sort()).toEqual(
      [...DISCLOSURE_RULES].sort()
    );
  });
});
