import type { LiveStream } from '@vp/domain';
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
  it('takes an idle stream live when its key publishes', () => {
    const stream = aLiveStream();

    expect(expectOk(decideLiveGatewayCall(input({ stream })))).toEqual({ type: 'go-live', stream });
  });

  it.each<{
    scenario: string;
    stream: Partial<LiveStream>;
    type: 'admit' | undefined;
    reason?: string;
  }>([
    { scenario: 'a LIVE stream', stream: { status: 'LIVE' }, type: 'admit' },
    {
      scenario: 'a LIVE stream its creator stopped',
      stream: { status: 'LIVE', stopRequestedAt: new Date(1) },
      type: undefined,
      reason: 'stopping',
    },
    {
      scenario: 'an ENDED stream',
      stream: { status: 'ENDED' },
      type: undefined,
      reason: 'not-idle',
    },
  ])('answers a publisher on $scenario', ({ stream, type, reason }) => {
    const decided = decideLiveGatewayCall(input({ stream: aLiveStream(stream) }));

    if (type) expect(expectOk(decided)).toEqual({ type });
    else expect(expectErr(decided)).toMatchObject({ reason });
  });

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
