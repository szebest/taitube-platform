import { machineFindings } from '@kit/machine';
import { API_TOKEN } from '../api-token.machine';

describe('@vp/domain-rules: API_TOKEN', () => {
  it('has no structural finding', () => {
    expect(machineFindings(API_TOKEN)).toEqual([]);
  });

  it.each([
    { from: 'active', event: 'use', to: 'active' },
    { from: 'active', event: 'expire', to: 'expired' },
    { from: 'active', event: 'revoke', to: 'revoked' },
    { from: 'expired', event: 'revoke', to: 'revoked' },
    { from: 'expired', event: 'use', to: undefined },
    { from: 'revoked', event: 'use', to: undefined },
    { from: 'revoked', event: 'revoke', to: undefined },
  ] as const)('$event from $from: $to', ({ from, event, to }) => {
    expect(API_TOKEN.next(from, event)).toBe(to);
  });
});
