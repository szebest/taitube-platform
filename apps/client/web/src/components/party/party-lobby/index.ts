import {
  PartyLobbyActions,
  PartyLobbyCountdown,
  PartyLobbyReadyCheck,
  PartyLobbyRoot,
  PartyLobbyStatus,
} from './party-lobby';

export const PartyLobby = {
  Root: PartyLobbyRoot,
  Status: PartyLobbyStatus,
  Countdown: PartyLobbyCountdown,
  ReadyCheck: PartyLobbyReadyCheck,
  Actions: PartyLobbyActions,
};
export type {
  PartyLobbyActionsProps,
  PartyLobbyMember,
  PartyLobbyReadyCheckProps,
  PartyLobbyRootProps,
} from './party-lobby';
