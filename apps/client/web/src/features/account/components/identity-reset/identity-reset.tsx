import { useEffect, useEffectEvent } from 'react';
import { useResetIdentity } from '#app/features/account/hooks/use-reset-identity';
import { useMergeState } from '../preferences-sync/merge-state.context';

/**
 * An account switch is merged by AccountMerge itself; signing out leaves the device holding the
 * account's settings, so it is reset here. A sign-out mounts the tree below the session again, so
 * the account last merged, which the tab keeps above it, is what says one was signed in.
 */
export function IdentityReset({ userId }: { userId: string | undefined }) {
  const reset = useResetIdentity();
  const { applied } = useMergeState();

  const resetForNewIdentity = useEffectEvent(() => {
    if (applied.current !== undefined) reset();
  });

  useEffect(() => {
    if (userId === undefined) resetForNewIdentity();
  }, [userId]);

  return null;
}
