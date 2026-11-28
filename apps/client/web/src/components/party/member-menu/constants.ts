import type { PersonalControlValues } from '@vp/domain';
import type { MemberControlScope, MemberMuteDuration } from './types';

export const MUTE_DURATIONS = [
  { value: '10m', label: 'party.memberMuteTenMinutes' },
  { value: '1h', label: 'party.memberMuteOneHour' },
  { value: 'party', label: 'party.memberMuteParty' },
] as const satisfies readonly { value: MemberMuteDuration; label: string }[];

/** The personal controls a member menu offers, in order, and the scope each holds in. */
export const CONTROL_FLAGS = [
  { flag: 'hideMessages', label: 'party.controlHideMessages', scope: 'both' },
  { flag: 'voiceMuted', label: 'party.controlMute', scope: 'both' },
  { flag: 'blockInvites', label: 'party.controlBlockInvites', scope: 'everywhere' },
  { flag: 'hideAvatar', label: 'party.controlHideAvatar', scope: 'both' },
  { flag: 'favourite', label: 'party.controlFavourite', scope: 'both' },
] as const satisfies readonly {
  flag: Exclude<keyof PersonalControlValues, 'volume'>;
  label: string;
  scope: MemberControlScope | 'both';
}[];
