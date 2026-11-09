import { type Result, err, isErr, ok } from '@vp/result';
import { normalizePlainText, withinLength } from '../plain-text';
import { foldForMatching } from './blocked-words';
import { type InvalidCommentSettings, invalidCommentSettings } from './failures';

export const SLOW_MODE_SECONDS = [5, 10, 30, 60, 300] as const;

const WHITESPACE_RUN = /\s+/g;
const MAX_BLOCKED_WORDS = 200;
const BLOCKED_WORD_BOUNDS = { minLength: 2, maxLength: 40 };
const MAX_ALLOWED_HOSTS = 50;
const MIN_ACCOUNT_AGE_DAYS = 0;
const MAX_ACCOUNT_AGE_DAYS = 30;

export interface CommentSettingsInput {
  readonly blockedWords: readonly string[];
  readonly linkAllowlist: readonly string[];
  readonly slowModeSeconds: number | null;
  readonly minAccountAgeDays: number;
}

/** Keeps the first spelling of each entry, so two spellings that fold alike are one. */
function uniqueBy(values: readonly string[], key: (value: string) => string): string[] {
  const seen = new Map<string, string>();
  for (const value of values) {
    const folded = key(value);
    if (!seen.has(folded)) seen.set(folded, value);
  }
  return [...seen.values()];
}

function isHostname(value: string): boolean {
  const target = `https://${value}`;
  return value.includes('.') && URL.canParse(target) && new URL(target).hostname === value;
}

function checkedWords(words: readonly string[]): Result<string[], InvalidCommentSettings> {
  const cleaned = words.map((word) => normalizePlainText(word).replace(WHITESPACE_RUN, ' '));
  const kept = uniqueBy(cleaned, foldForMatching);
  const fits =
    kept.length <= MAX_BLOCKED_WORDS &&
    kept.every((word) => withinLength(word, BLOCKED_WORD_BOUNDS));
  return fits
    ? ok(kept)
    : err(
        invalidCommentSettings(
          'blockedWords',
          `Use at most ${MAX_BLOCKED_WORDS} words of ${BLOCKED_WORD_BOUNDS.minLength} to ${BLOCKED_WORD_BOUNDS.maxLength} characters`,
          { max: MAX_BLOCKED_WORDS }
        )
      );
}

function checkedHosts(hosts: readonly string[]): Result<string[], InvalidCommentSettings> {
  const kept = uniqueBy(
    hosts.map((host) => host.trim().toLowerCase()),
    (host) => host
  );
  return kept.length <= MAX_ALLOWED_HOSTS && kept.every(isHostname)
    ? ok(kept)
    : err(
        invalidCommentSettings('linkAllowlist', `Use at most ${MAX_ALLOWED_HOSTS} host names`, {
          max: MAX_ALLOWED_HOSTS,
        })
      );
}

export function validateCommentSettings(
  input: CommentSettingsInput
): Result<CommentSettingsInput, InvalidCommentSettings> {
  const blockedWords = checkedWords(input.blockedWords);
  if (isErr(blockedWords)) return blockedWords;
  const linkAllowlist = checkedHosts(input.linkAllowlist);
  if (isErr(linkAllowlist)) return linkAllowlist;

  const { slowModeSeconds, minAccountAgeDays } = input;
  if (
    slowModeSeconds !== null &&
    !(SLOW_MODE_SECONDS as readonly number[]).includes(slowModeSeconds)
  ) {
    return err(
      invalidCommentSettings('slowModeSeconds', 'Pick one of the slow mode intervals', {
        allowed: SLOW_MODE_SECONDS,
      })
    );
  }
  if (
    !Number.isInteger(minAccountAgeDays) ||
    minAccountAgeDays < MIN_ACCOUNT_AGE_DAYS ||
    minAccountAgeDays > MAX_ACCOUNT_AGE_DAYS
  ) {
    return err(
      invalidCommentSettings(
        'minAccountAgeDays',
        `Use ${MIN_ACCOUNT_AGE_DAYS} to ${MAX_ACCOUNT_AGE_DAYS} days`,
        { min: MIN_ACCOUNT_AGE_DAYS, max: MAX_ACCOUNT_AGE_DAYS }
      )
    );
  }
  return ok({
    blockedWords: blockedWords.value,
    linkAllowlist: linkAllowlist.value,
    slowModeSeconds,
    minAccountAgeDays,
  });
}
