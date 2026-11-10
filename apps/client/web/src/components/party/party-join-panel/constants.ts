import type { PartyJoinState, PartyPasswordError } from './types';

export const STATE_NOTICE = {
  banned: 'party.previewBanned',
  guests_off: 'party.previewGuestsOff',
  closed: 'party.previewClosedTitle',
  not_found: 'party.previewNotFound',
} as const satisfies Partial<Record<PartyJoinState, string>>;

export const PASSWORD_ERROR_COPY = {
  invalid: 'party.previewPasswordInvalid',
  locked: 'party.previewPasswordLocked',
} as const satisfies Record<PartyPasswordError, string>;
