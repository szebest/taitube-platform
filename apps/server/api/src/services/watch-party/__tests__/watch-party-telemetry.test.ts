import { ErrorCodes, watchPartyFull, watchPartyPermissionMissing } from '@vp/errors';
import { err, ok, type Result } from '@vp/result';
import {
  countCommand,
  countDenial,
  countJoin,
  countRoleEscalation,
  inSpan,
} from '../watch-party-telemetry';
import { reading, watchPartyTestDeps } from './watch-party-test-deps';

type Outcome = Result<number, { readonly code: string }>;

describe('watch party telemetry', () => {
  it.each<{ result: Outcome; outcome: string }>([
    { result: ok(1), outcome: 'joined' },
    { result: err(watchPartyFull('r', 5, 5)), outcome: 'full' },
    { result: err({ code: ErrorCodes.WATCH_PARTY_PASSWORD_LOCKED }), outcome: 'locked' },
    { result: err({ code: ErrorCodes.WATCH_PARTY_BANNED }), outcome: 'banned' },
  ])('counts a join that ended $outcome', async ({ result, outcome }) => {
    const { metrics, deps } = watchPartyTestDeps();

    expect(countJoin(deps, 'guest', result)).toBe(result);

    expect(await reading(metrics.watchPartyJoinsTotal, { kind: 'guest', outcome })).toBe(1);
  });

  it('leaves a failure that is not about the room’s rules out of the join counts', async () => {
    const { metrics, deps } = watchPartyTestDeps();

    countJoin(deps, 'user', err({ code: ErrorCodes.DATABASE_UNAVAILABLE }));

    expect(await reading(metrics.watchPartyJoinsTotal)).toBe(0);
  });

  it.each<{ result: Outcome; counted: string }>([
    { result: ok(1), counted: 'applied' },
    { result: err({ code: ErrorCodes.WATCH_PARTY_STATE_STALE }), counted: 'stale' },
    { result: err(watchPartyPermissionMissing('playback.control')), counted: 'forbidden' },
    { result: err({ code: ErrorCodes.RATE_LIMITED }), counted: 'refused' },
  ])('counts a command that was $counted', async ({ result, counted }) => {
    const { metrics, deps } = watchPartyTestDeps();

    countCommand(deps, 'seek', result);

    expect(
      await reading(metrics.watchPartyCommandsTotal, { command: 'seek', result: counted })
    ).toBe(1);
  });

  it('counts a denial against its permission, and nothing else', async () => {
    const { metrics, deps } = watchPartyTestDeps();

    countDenial(deps, 'guest', watchPartyPermissionMissing('chat.pin'));
    countDenial(deps, 'guest', { code: ErrorCodes.RATE_LIMITED });

    expect(await reading(metrics.watchPartyPermissionDenialsTotal)).toBe(1);
    expect(
      await reading(metrics.watchPartyPermissionDenialsTotal, {
        permission: 'chat.pin',
        kind: 'guest',
      })
    ).toBe(1);
  });

  it('counts an escalation against the action that tried it', async () => {
    const { metrics, deps } = watchPartyTestDeps();

    countRoleEscalation(deps, 'assign', err({ code: ErrorCodes.WATCH_PARTY_ROLE_ESCALATION }));
    countRoleEscalation(deps, 'assign', err({ code: ErrorCodes.WATCH_PARTY_ROLE_PROTECTED }));

    expect(
      await reading(metrics.watchPartyRoleChangesTotal, { action: 'assign', result: 'escalation' })
    ).toBe(1);
  });

  it('runs the operation inside a span and hands its result back as it was', async () => {
    const result = err({ code: ErrorCodes.WATCH_PARTY_CLOSED });

    expect(await inSpan('join', { 'room.id': 'r' }, async () => result)).toBe(result);
    expect(await inSpan('command', {}, async () => ok(2))).toEqual(ok(2));
  });
});
