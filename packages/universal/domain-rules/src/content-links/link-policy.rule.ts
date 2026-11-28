import { type Result, assertNever, err, ok } from '@kit/result';
import type { LinkPolicy } from '@vp/domain';
import {
  type LinkTargetBlocks,
  type LinkTargetNotPublic,
  linkTargetBlocks,
  linkTargetNotPublic,
} from './failures';

export interface LinkPolicyInput {
  readonly sourceChannelId: string;
  readonly targetChannelId: string;
  readonly policy: LinkPolicy;
  /** Public and ready: a cross-channel target must be both. */
  readonly targetPublic: boolean;
}

export type LinkPolicyFailure = LinkTargetBlocks | LinkTargetNotPublic;

/** The status a creator's link starts in: their own channel is always `active`, another channel's setting decides. */
export function decideLinkStatus(
  input: LinkPolicyInput
): Result<'active' | 'pending', LinkPolicyFailure> {
  const { sourceChannelId, targetChannelId, policy, targetPublic } = input;
  if (sourceChannelId === targetChannelId) return ok('active');
  if (!targetPublic) return err(linkTargetNotPublic());
  switch (policy) {
    case 'allow':
      return ok('active');
    case 'approve':
      return ok('pending');
    case 'block':
      return err(linkTargetBlocks(targetChannelId));
    default:
      return assertNever(policy, 'decideLinkStatus');
  }
}
