import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { ADMIN, aLiveStream, OWNER, STRANGER } from '../../__tests__/entities';
import {
  decideLiveStreamStop,
  decideLiveStreamUpdate,
  type ManageLiveStreamInput,
} from '../manage-stream.rule';

function input(overrides: Partial<ManageLiveStreamInput> = {}): ManageLiveStreamInput {
  return {
    actor: OWNER,
    streamId: 'stream-1',
    stream: aLiveStream(),
    ownerId: OWNER.id,
    ...overrides,
  };
}

describe('@vp/domain-rules: decideLiveStreamUpdate', () => {
  it.each([
    { who: 'the owner', actor: OWNER },
    { who: 'an admin', actor: ADMIN },
  ])('lets $who manage the stream', ({ actor }) => {
    expect(expectOk(decideLiveStreamUpdate(input({ actor }))).id).toBe('stream-1');
  });

  it.each([
    {
      scenario: 'a stranger',
      overrides: { actor: STRANGER },
      code: ErrorCodes.LIVE_STREAM_NOT_FOUND,
    },
    {
      scenario: 'a missing stream',
      overrides: { stream: null, ownerId: null },
      code: ErrorCodes.LIVE_STREAM_NOT_FOUND,
    },
    { scenario: 'an anonymous caller', overrides: { actor: null }, code: ErrorCodes.UNAUTHORIZED },
  ])('refuses $scenario', ({ overrides, code }) => {
    expect(expectErr(decideLiveStreamUpdate(input(overrides))).code).toBe(code);
  });
});

describe('@vp/domain-rules: decideLiveStreamStop', () => {
  it('stops a live stream', () => {
    expect(
      expectOk(decideLiveStreamStop(input({ stream: aLiveStream({ status: 'LIVE' }) }))).status
    ).toBe('LIVE');
  });

  it('refuses a stream that is not live', () => {
    expect(expectErr(decideLiveStreamStop(input())).code).toBe(ErrorCodes.LIVE_STREAM_NOT_LIVE);
  });
});
