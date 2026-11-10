import { DEFAULT_COMMENT_SETTINGS, type CommentSettings } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { isErr, isOk } from '@vp/result';
import { type CommentGateContext, evaluateCommentGate } from '../comment-gate.rule';

const NOW = new Date('2026-06-15T12:00:00.000Z');
const DAY_MS = 86_400_000;

const settings = (patch: Partial<CommentSettings> = {}): CommentSettings => ({
  ...DEFAULT_COMMENT_SETTINGS,
  ...patch,
});

const context = (patch: Partial<CommentGateContext> = {}): CommentGateContext => ({
  now: NOW,
  videoId: 'video-1',
  channelId: 'channel-1',
  commentsEnabled: true,
  restriction: null,
  isTeamMember: false,
  isSubscribed: false,
  isTrusted: false,
  accountCreatedAt: new Date(NOW.getTime() - 100 * DAY_MS),
  ...patch,
});

const PLAIN = 'a perfectly fine comment';
const LINK = 'see https://evil.io/x';
const ALLOWED_LINK = 'see https://example.com/x';
const BLOCKED = 'this is Spam';

const banned = { kind: 'ban' as const, reason: 'rude', expiresAt: null };

describe('@vp/domain-rules: evaluateCommentGate refusals, in order', () => {
  it.each([
    {
      scenario: 'a ban, before everything else',
      settings: settings({ subscribersOnly: true, minAccountAgeDays: 30 }),
      context: context({ restriction: banned, commentsEnabled: false }),
      code: ErrorCodes.COMMENTS_BANNED,
    },
    {
      scenario: 'a ban that has not run out',
      settings: settings(),
      context: context({
        restriction: { ...banned, expiresAt: new Date(NOW.getTime() + 1) },
      }),
      code: ErrorCodes.COMMENTS_BANNED,
    },
    {
      scenario: 'comments turned off',
      settings: settings({ subscribersOnly: true }),
      context: context({ commentsEnabled: false }),
      code: ErrorCodes.COMMENTS_DISABLED,
    },
    {
      scenario: 'subscribers only for a stranger',
      settings: settings({ subscribersOnly: true, minAccountAgeDays: 30 }),
      context: context({ accountCreatedAt: NOW }),
      code: ErrorCodes.COMMENTS_SUBSCRIBERS_ONLY,
    },
    {
      scenario: 'an account that is too new',
      settings: settings({ minAccountAgeDays: 7 }),
      context: context({ accountCreatedAt: new Date(NOW.getTime() - 6 * DAY_MS) }),
      code: ErrorCodes.COMMENTS_ACCOUNT_TOO_NEW,
    },
  ])('refuses $scenario with $code', ({ settings: rules, context: who, code }) => {
    const result = evaluateCommentGate(rules, who, PLAIN);

    expect(isErr(result) && result.error.code).toBe(code);
  });

  it.each([
    {
      scenario: 'a shadow ban',
      restriction: { kind: 'shadow' as const, reason: null, expiresAt: null },
    },
    {
      scenario: 'a ban that ended',
      restriction: { ...banned, expiresAt: new Date(NOW.getTime() - 1) },
    },
    { scenario: 'a ban that ends right now', restriction: { ...banned, expiresAt: NOW } },
  ])('lets a comment through for $scenario', ({ restriction }) => {
    const result = evaluateCommentGate(settings(), context({ restriction }), PLAIN);

    expect(isOk(result) && result.value.decision).toBe('publish');
  });

  it.each([
    { scenario: 'the day the account is old enough', ageDays: 7, allowed: true },
    { scenario: 'a day short', ageDays: 6.5, allowed: false },
  ])('on $scenario', ({ ageDays, allowed }) => {
    const result = evaluateCommentGate(
      settings({ minAccountAgeDays: 7 }),
      context({ accountCreatedAt: new Date(NOW.getTime() - ageDays * DAY_MS) }),
      PLAIN
    );

    expect(isOk(result)).toBe(allowed);
  });

  it('says on which day the account opens', () => {
    const created = new Date(NOW.getTime() - 2 * DAY_MS);

    const result = evaluateCommentGate(
      settings({ minAccountAgeDays: 7 }),
      context({ accountCreatedAt: created }),
      PLAIN
    );

    expect(isErr(result) && result.error).toMatchObject({
      opensAt: new Date(created.getTime() + 7 * DAY_MS).toISOString(),
    });
  });
});

describe('@vp/domain-rules: evaluateCommentGate holds', () => {
  const heldBy = {
    review_all: { reviewMode: 'all' as const },
    link: { reviewMode: 'links' as const, linkAllowlist: ['example.com'] },
    blocked_word: { blockedWords: ['spam'] },
  };

  it.each([
    { mode: 'none', link: false, word: false, held: null },
    { mode: 'none', link: true, word: false, held: null },
    { mode: 'none', link: false, word: true, held: 'blocked_word' },
    { mode: 'none', link: true, word: true, held: 'blocked_word' },
    { mode: 'links', link: false, word: false, held: null },
    { mode: 'links', link: true, word: false, held: 'link' },
    { mode: 'links', link: false, word: true, held: 'blocked_word' },
    { mode: 'links', link: true, word: true, held: 'blocked_word' },
    { mode: 'all', link: false, word: false, held: 'review_all' },
    { mode: 'all', link: true, word: false, held: 'review_all' },
    { mode: 'all', link: false, word: true, held: 'blocked_word' },
    { mode: 'all', link: true, word: true, held: 'blocked_word' },
  ] as const)(
    'mode $mode, link $link, blocked word $word: held for $held',
    ({ mode, link, word, held }) => {
      const text = [PLAIN, link ? LINK : '', word ? BLOCKED : ''].join(' ');

      const result = evaluateCommentGate(
        settings({ reviewMode: mode, blockedWords: ['spam'], linkAllowlist: ['example.com'] }),
        context(),
        text
      );

      expect(isOk(result) && result.value).toMatchObject({
        decision: held ? 'hold' : 'publish',
        heldReason: held,
      });
    }
  );

  it.each([
    {
      reason: 'review_all' as const,
      rule: 'auto.review_all' as const,
      text: PLAIN,
      disclosure: 'silent' as const,
    },
    {
      reason: 'link' as const,
      rule: 'auto.links' as const,
      text: LINK,
      disclosure: 'silent' as const,
    },
    {
      reason: 'blocked_word' as const,
      rule: 'auto.blocked_words' as const,
      text: BLOCKED,
      disclosure: 'visible' as const,
    },
  ])(
    'discloses a $reason hold as $disclosure when its rule says so',
    ({ reason, rule, text, disclosure }) => {
      const result = evaluateCommentGate(
        settings({
          ...heldBy[reason],
          disclosure: { ...DEFAULT_COMMENT_SETTINGS.disclosure, [rule]: disclosure },
        }),
        context(),
        text
      );

      expect(isOk(result) && result.value).toMatchObject({ heldReason: reason, disclosure });
    }
  );

  it('lets a link to an allowed host and its subdomains through in links mode', () => {
    const result = evaluateCommentGate(
      settings(heldBy.link),
      context(),
      `${ALLOWED_LINK} and https://blog.example.com`
    );

    expect(isOk(result) && result.value.decision).toBe('publish');
  });

  it.each([
    { scenario: 'a trusted commenter', patch: { isTrusted: true } },
    { scenario: 'a channel member', patch: { isTeamMember: true } },
  ])('holds nothing from $scenario', ({ patch }) => {
    const result = evaluateCommentGate(
      settings({ reviewMode: 'all', blockedWords: ['spam'] }),
      context(patch),
      BLOCKED
    );

    expect(isOk(result) && result.value).toEqual({
      decision: 'publish',
      heldReason: null,
      disclosure: null,
      slowModeSeconds: null,
    });
  });
});

describe('@vp/domain-rules: evaluateCommentGate exemptions and slow mode', () => {
  it.each([
    { scenario: 'a stranger', patch: {}, seconds: 30 },
    { scenario: 'a trusted commenter', patch: { isTrusted: true }, seconds: null },
    { scenario: 'a channel member', patch: { isTeamMember: true }, seconds: null },
  ])('hands $scenario slow mode of $seconds', ({ patch, seconds }) => {
    const result = evaluateCommentGate(settings({ slowModeSeconds: 30 }), context(patch), PLAIN);

    expect(isOk(result) && result.value.slowModeSeconds).toBe(seconds);
  });

  it('has no slow mode when the channel set none', () => {
    const result = evaluateCommentGate(settings(), context(), PLAIN);

    expect(isOk(result) && result.value.slowModeSeconds).toBeNull();
  });

  it.each([
    { scenario: 'comments off', settings: settings(), patch: { commentsEnabled: false } },
    { scenario: 'subscribers only', settings: settings({ subscribersOnly: true }), patch: {} },
    {
      scenario: 'an account that is too new',
      settings: settings({ minAccountAgeDays: 30 }),
      patch: { accountCreatedAt: NOW },
    },
  ])('lets a channel member through $scenario', ({ settings: rules, patch }) => {
    const result = evaluateCommentGate(rules, context({ isTeamMember: true, ...patch }), PLAIN);

    expect(isOk(result)).toBe(true);
  });

  it('lets a subscriber through subscribers only', () => {
    const result = evaluateCommentGate(
      settings({ subscribersOnly: true }),
      context({ isSubscribed: true }),
      PLAIN
    );

    expect(isOk(result)).toBe(true);
  });

  it('lets a trusted commenter past the account age but not past comments off', () => {
    const young = { accountCreatedAt: NOW, isTrusted: true };

    expect(
      isOk(evaluateCommentGate(settings({ minAccountAgeDays: 30 }), context(young), PLAIN))
    ).toBe(true);
    expect(
      isErr(evaluateCommentGate(settings(), context({ ...young, commentsEnabled: false }), PLAIN))
    ).toBe(true);
  });
});
