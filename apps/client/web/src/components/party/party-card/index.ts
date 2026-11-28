import {
  PartyCardAction,
  PartyCardHost,
  PartyCardMeta,
  PartyCardPill,
  PartyCardRoot,
  PartyCardRoster,
  PartyCardThumb,
  PartyCardTitle,
} from './party-card';

export const PartyCard = {
  Root: PartyCardRoot,
  Thumb: PartyCardThumb,
  Pill: PartyCardPill,
  Title: PartyCardTitle,
  Host: PartyCardHost,
  Roster: PartyCardRoster,
  Meta: PartyCardMeta,
  Action: PartyCardAction,
};
export type { PartyCardRootProps } from './party-card';
export type { PartyCardState } from './types';
