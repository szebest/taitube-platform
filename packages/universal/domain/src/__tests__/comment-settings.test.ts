import {
  COMMENT_SETTINGS_FIELDS,
  DEFAULT_COMMENT_SETTINGS,
  DISCLOSURE_RULES,
  SAVED_REPLY_LIMITS,
  type Disclosure,
  type DisclosureRule,
} from '../comment-settings';

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

  it.each<{ rule: DisclosureRule; disclosure: Disclosure }>([
    { rule: 'hide', disclosure: 'silent' },
    { rule: 'remove', disclosure: 'visible' },
    { rule: 'manual_hold', disclosure: 'visible' },
    { rule: 'auto.blocked_words', disclosure: 'silent' },
    { rule: 'auto.links', disclosure: 'visible' },
    { rule: 'auto.review_all', disclosure: 'visible' },
  ])('discloses $rule as $disclosure by default', ({ rule, disclosure }) => {
    expect(DEFAULT_COMMENT_SETTINGS.disclosure[rule]).toBe(disclosure);
  });

  it('has a default for every rule and no other', () => {
    expect(Object.keys(DEFAULT_COMMENT_SETTINGS.disclosure).sort()).toEqual(
      [...DISCLOSURE_RULES].sort()
    );
  });

  it('names every settings field', () => {
    expect([...COMMENT_SETTINGS_FIELDS].sort()).toEqual(
      Object.keys(DEFAULT_COMMENT_SETTINGS).sort()
    );
  });
});

describe('@vp/domain: saved reply limits', () => {
  it('keeps up to 20 replies of a 40 character title and a 2000 character body', () => {
    expect(SAVED_REPLY_LIMITS).toEqual({ perChannel: 20, titleLength: 40, bodyLength: 2000 });
  });
});
