export type PartyJoinState =
  | 'yes'
  | 'password'
  | 'full'
  | 'banned'
  | 'guests_off'
  | 'closed'
  | 'not_found';

export type PartyJoinAction = 'guest' | 'discord' | 'sign_in';

export type PartyPasswordError = 'invalid' | 'locked';
