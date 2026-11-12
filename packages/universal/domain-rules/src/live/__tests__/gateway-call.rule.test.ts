import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { aLiveStream } from '../../__tests__/entities';
import {
  decideLiveGatewayCall,
  LIVE_READER_USER,
  type LiveGatewayCallInput,
} from '../gateway-call.rule';

const SECRET = 'hook-secret';

function input(overrides: Partial<LiveGatewayCallInput> = {}): LiveGatewayCallInput {
  return {
    configuredSecret: SECRET,
    presentedSecret: SECRET,
    call: { action: 'publish', path: 'live/key-1', user: '', password: '' },
    stream: aLiveStream(),
    ...overrides,
  };
}

const readBy = (user: string, password: string) => ({
  call: { action: 'read', path: 'live/key-1', user, password },
});

describe('@vp/domain-rules: decideLiveGatewayCall', () => {
  it.each([
    ['IDLE', 'publish', false, 'go-live'],
    ['IDLE', 'publish', true, 'go-live'],
    ['LIVE', 'publish', false, 'admit'],
    ['LIVE', 'publish', true, 'refuse:stopping'],
    ['ENDED', 'publish', false, 'refuse:not-idle'],
    ['ENDED', 'publish', true, 'refuse:not-idle'],
    ['IDLE', 'read', false, 'admit'],
    ['IDLE', 'read', true, 'admit'],
    ['LIVE', 'read', false, 'admit'],
    ['LIVE', 'read', true, 'admit'],
    ['ENDED', 'read', false, 'admit'],
    ['ENDED', 'read', true, 'admit'],
  ] as const)(
    'a %s stream, call %s, stop requested %s: %s',
    (status, action, stopRequested, expected) => {
      const stream = aLiveStream({
        status,
        stopRequestedAt: stopRequested ? new Date(1) : null,
      });
      const call =
        action === 'read'
          ? readBy(LIVE_READER_USER, SECRET)
          : { call: { action, path: 'live/key-1', user: '', password: '' } };

      const decided = decideLiveGatewayCall(input({ stream, ...call }));

      if (expected.startsWith('refuse:')) {
        expect(expectErr(decided)).toMatchObject({ reason: expected.slice('refuse:'.length) });
      } else {
        expect(expectOk(decided)).toEqual(
          expected === 'go-live' ? { type: expected, stream } : { type: expected }
        );
      }
    }
  );

  it.each([
    {
      scenario: 'no secret configured',
      overrides: { configuredSecret: undefined },
      reason: 'hook-secret',
    },
    {
      scenario: 'a wrong secret',
      overrides: { presentedSecret: 'hook-secreT' },
      reason: 'hook-secret',
    },
    { scenario: 'a shorter secret', overrides: { presentedSecret: 'hook' }, reason: 'hook-secret' },
    {
      scenario: 'no secret presented',
      overrides: { presentedSecret: undefined },
      reason: 'hook-secret',
    },
    { scenario: 'an unknown key', overrides: { stream: null }, reason: 'unknown-key' },
    {
      scenario: 'a reader other than the worker',
      overrides: readBy('viewer', SECRET),
      reason: 'reader',
    },
    {
      scenario: 'the worker with a wrong password',
      overrides: readBy(LIVE_READER_USER, 'nope'),
      reason: 'reader',
    },
    {
      scenario: 'any other action',
      overrides: { call: { action: 'playback', path: 'live/key-1', user: '', password: '' } },
      reason: 'action',
    },
  ])('refuses $scenario', ({ overrides, reason }) => {
    expect(expectErr(decideLiveGatewayCall(input(overrides)))).toEqual({
      code: ErrorCodes.LIVE_INGEST_REFUSED,
      message: 'Ingest refused',
      reason,
    });
  });

  it('admits the live worker reading with the secret', () => {
    expect(expectOk(decideLiveGatewayCall(input(readBy(LIVE_READER_USER, SECRET))))).toEqual({
      type: 'admit',
    });
  });
});
