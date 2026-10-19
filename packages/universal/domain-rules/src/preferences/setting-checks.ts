import type { Setting, TextKind } from '@vp/domain/settings';
import { assertNever, isOk, tryCatch } from '@vp/result';

/** Theme and token-set ids. The server knows no registry, so any id of this shape is stored. */
export const PREFERENCE_ID_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;
/** Token group names, camelCase because `fontSize` is one. */
export const TOKEN_GROUP_PATTERN = /^[a-z][a-zA-Z0-9]{0,31}$/;
export const ACCENT_PATTERN = /^#[0-9a-f]{6}$/i;
export const MAX_TOKEN_OVERRIDES = 16;

function isLanguageTag(tag: string): boolean {
  return isOk(
    tryCatch(
      () => Intl.getCanonicalLocales(tag),
      () => null
    )
  );
}

function isText(kind: TextKind, value: string): boolean {
  switch (kind) {
    case 'preferenceId':
      return PREFERENCE_ID_PATTERN.test(value);
    case 'accent':
      return ACCENT_PATTERN.test(value);
    case 'languageTag':
      return isLanguageTag(value);
    default:
      return assertNever(kind, 'TextKind');
  }
}

function isTokenOverrides(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const entries = Object.entries(value);
  return (
    entries.length <= MAX_TOKEN_OVERRIDES &&
    entries.every(
      ([group, set]) =>
        TOKEN_GROUP_PATTERN.test(group) &&
        typeof set === 'string' &&
        PREFERENCE_ID_PATTERN.test(set)
    )
  );
}

/** Whether a stored value is one the setting accepts. */
export function isSettingValue(setting: Setting, value: unknown): boolean {
  switch (setting.type) {
    case 'choice':
      return setting.options.some((option) => option === value);
    case 'flag':
      return typeof value === 'boolean';
    case 'text':
      return value === null || (typeof value === 'string' && isText(setting.kind, value));
    case 'tokenOverrides':
      return isTokenOverrides(value);
    default:
      return assertNever(setting, 'Setting');
  }
}
