import { Counter, Gauge, Histogram, type Registry } from 'prom-client';

/** Watch party rooms, watched from the API pods that hold their sockets (SDD §10.7). */
export interface WatchPartyMetrics {
  watchPartyRooms: Gauge<string>;
  watchPartyPresentMembers: Gauge<string>;
  watchPartySockets: Gauge<string>;
  watchPartyJoinsTotal: Counter<string>;
  watchPartySeatUpgradesTotal: Counter<string>;
  watchPartyCommandsTotal: Counter<string>;
  watchPartyPermissionDenialsTotal: Counter<string>;
  watchPartyRoleChangesTotal: Counter<string>;
  watchPartyDriftSeconds: Histogram<string>;
  watchPartyHardSeeksTotal: Counter<string>;
  watchPartyFanoutSeconds: Histogram<string>;
  watchPartyChatMessagesTotal: Counter<string>;
  watchPartyInvitesTotal: Counter<string>;
  watchPartyClockSkewSeconds: Gauge<string>;
}

export function createWatchPartyMetrics(registry: Registry): WatchPartyMetrics {
  const counter = (name: string, help: string, labelNames: string[]) =>
    new Counter({ name, help, labelNames, registers: [registry] });
  const gauge = (name: string, help: string, labelNames: string[] = []) =>
    new Gauge({ name, help, labelNames, registers: [registry] });

  return {
    watchPartyRooms: gauge('watch_party_rooms', 'Open watch party rooms by phase', ['phase']),
    watchPartyPresentMembers: gauge(
      'watch_party_present_members',
      'Members holding a room socket by kind',
      ['kind']
    ),
    watchPartySockets: gauge('watch_party_sockets', 'Room sockets this pod holds'),
    watchPartyJoinsTotal: counter('watch_party_joins_total', 'Join attempts by kind and outcome', [
      'kind',
      'outcome',
    ]),
    watchPartySeatUpgradesTotal: counter(
      'watch_party_seat_upgrades_total',
      'Guest seats upgraded to an account or a Discord identity',
      ['to']
    ),
    watchPartyCommandsTotal: counter(
      'watch_party_commands_total',
      'Playback commands by command and result',
      ['command', 'result']
    ),
    watchPartyPermissionDenialsTotal: counter(
      'watch_party_permission_denials_total',
      'Actions refused for a missing room permission',
      ['permission', 'kind']
    ),
    watchPartyRoleChangesTotal: counter(
      'watch_party_role_changes_total',
      'Role changes by action and result',
      ['action', 'result']
    ),
    watchPartyDriftSeconds: new Histogram({
      name: 'watch_party_drift_seconds',
      help: 'Absolute drift of a member from the room clock, as members report it',
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
      registers: [registry],
    }),
    watchPartyHardSeeksTotal: counter(
      'watch_party_hard_seeks_total',
      'Hard seeks members made to catch up with the room clock',
      []
    ),
    watchPartyFanoutSeconds: new Histogram({
      name: 'watch_party_fanout_seconds',
      help: 'Time from a room frame being published to it being written to a socket on a pod',
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.15, 0.25, 0.5, 1],
      registers: [registry],
    }),
    watchPartyChatMessagesTotal: counter(
      'watch_party_chat_messages_total',
      'Chat lines by source and outcome',
      ['source', 'outcome']
    ),
    watchPartyInvitesTotal: counter('watch_party_invites_total', 'Invites by outcome', ['outcome']),
    watchPartyClockSkewSeconds: gauge(
      'watch_party_clock_skew_seconds',
      'This pod clock minus the database clock'
    ),
  };
}
