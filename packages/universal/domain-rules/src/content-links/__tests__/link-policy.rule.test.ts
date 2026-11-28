import { isErr, isOk } from '@kit/result';
import type { LinkPolicy } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { decideLinkStatus } from '../link-policy.rule';

describe('@vp/domain-rules: decideLinkStatus', () => {
  it.each<{ scenario: string; target: string; policy: LinkPolicy; status: string }>([
    { scenario: 'the own channel, even on block', target: 'c1', policy: 'block', status: 'active' },
    { scenario: 'another channel on allow', target: 'c2', policy: 'allow', status: 'active' },
    { scenario: 'another channel on approve', target: 'c2', policy: 'approve', status: 'pending' },
  ])('$scenario starts $status', ({ target, policy, status }) => {
    const result = decideLinkStatus({
      sourceChannelId: 'c1',
      targetChannelId: target,
      policy,
      targetPublic: true,
    });
    expect(isOk(result) && result.value).toBe(status);
  });

  it.each([
    {
      scenario: 'a private target',
      policy: 'allow' as const,
      targetPublic: false,
      code: ErrorCodes.LINK_TARGET_NOT_PUBLIC,
    },
    {
      scenario: 'a channel on block',
      policy: 'block' as const,
      targetPublic: true,
      code: ErrorCodes.LINK_TARGET_BLOCKS,
    },
  ])('refuses $code', ({ policy, targetPublic, code }) => {
    const result = decideLinkStatus({
      sourceChannelId: 'c1',
      targetChannelId: 'c2',
      policy,
      targetPublic,
    });
    expect(isErr(result) && result.error.code).toBe(code);
  });
});
