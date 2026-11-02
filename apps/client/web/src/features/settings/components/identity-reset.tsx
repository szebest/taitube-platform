import { useEffect, useEffectEvent, useRef } from 'react';

import { useResetIdentity } from '../hooks/use-reset-identity';

/** An account switch is merged by AccountMerge itself; signing out leaves the device holding the account's settings, so it is reset here. */
export function IdentityReset({ userId }: { userId: string | undefined }) {
  const reset = useResetIdentity();
  const seen = useRef(userId);

  const resetForNewIdentity = useEffectEvent(reset);

  useEffect(() => {
    const wasSignedIn = seen.current !== undefined;
    seen.current = userId;
    if (wasSignedIn && userId === undefined) resetForNewIdentity();
  }, [userId]);

  return null;
}
