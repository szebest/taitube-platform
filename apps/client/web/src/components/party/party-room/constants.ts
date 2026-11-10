import type { PartyRoomTab } from './types';

export const PARTY_ROOM_TABS = [
  { value: 'chat', label: 'party.tabsChat' },
  { value: 'people', label: 'party.tabsPeople' },
  { value: 'queue', label: 'party.tabsQueue' },
] as const satisfies readonly { value: PartyRoomTab; label: string }[];
