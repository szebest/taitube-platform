import type { MemberMuteDuration } from './types';

export const MUTE_DURATIONS = [
  { value: '10m', label: 'party.memberMuteTenMinutes' },
  { value: '1h', label: 'party.memberMuteOneHour' },
  { value: 'party', label: 'party.memberMuteParty' },
] as const satisfies readonly { value: MemberMuteDuration; label: string }[];
