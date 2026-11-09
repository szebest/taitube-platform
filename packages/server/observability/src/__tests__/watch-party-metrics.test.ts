import { Registry } from 'prom-client';
import { createWatchPartyMetrics } from '../watch-party-metrics';

describe('createWatchPartyMetrics', () => {
  it('exposes every watch party series of SDD §10.7 under its name and labels', async () => {
    const registry = new Registry();
    const metrics = createWatchPartyMetrics(registry);

    metrics.watchPartyRooms.set({ phase: 'playing' }, 2);
    metrics.watchPartyPresentMembers.set({ kind: 'guest' }, 5);
    metrics.watchPartySockets.set(7);
    metrics.watchPartyJoinsTotal.inc({ kind: 'user', outcome: 'full' });
    metrics.watchPartySeatUpgradesTotal.inc({ to: 'user' });
    metrics.watchPartyCommandsTotal.inc({ command: 'pause', result: 'stale' });
    metrics.watchPartyPermissionDenialsTotal.inc({ permission: 'chat.pin', kind: 'guest' });
    metrics.watchPartyRoleChangesTotal.inc({ action: 'assign', result: 'escalation' });
    metrics.watchPartyDriftSeconds.observe(0.3);
    metrics.watchPartyHardSeeksTotal.inc(2);
    metrics.watchPartyFanoutSeconds.observe(0.02);
    metrics.watchPartyChatMessagesTotal.inc({ source: 'app', outcome: 'sent' });
    metrics.watchPartyInvitesTotal.inc({ outcome: 'folded' });
    metrics.watchPartyClockSkewSeconds.set(0.01);

    const scrape = await registry.metrics();
    expect(
      scrape.split('\n').filter((line) => /^watch_party_\w+(\{.*\})? \S+$/.test(line))
    ).toEqual(
      expect.arrayContaining([
        'watch_party_rooms{phase="playing"} 2',
        'watch_party_present_members{kind="guest"} 5',
        'watch_party_sockets 7',
        'watch_party_joins_total{kind="user",outcome="full"} 1',
        'watch_party_seat_upgrades_total{to="user"} 1',
        'watch_party_commands_total{command="pause",result="stale"} 1',
        'watch_party_permission_denials_total{permission="chat.pin",kind="guest"} 1',
        'watch_party_role_changes_total{action="assign",result="escalation"} 1',
        'watch_party_drift_seconds_count 1',
        'watch_party_hard_seeks_total 2',
        'watch_party_fanout_seconds_count 1',
        'watch_party_chat_messages_total{source="app",outcome="sent"} 1',
        'watch_party_invites_total{outcome="folded"} 1',
        'watch_party_clock_skew_seconds 0.01',
      ])
    );
  });
});
