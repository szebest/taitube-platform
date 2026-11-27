import { useRouter } from '@tanstack/react-router';
import { useSyncExternalStore } from 'react';
import type { IdentityState, IdentityStore } from './identity-store';

/** The identity this tab acts as, from its router, and whether its URLs carry the prefix. */
export function useTabIdentity(): IdentityState {
  const { identity }: { identity: IdentityStore } = useRouter().options.context;
  return useSyncExternalStore(identity.subscribe, identity.read, identity.read);
}
