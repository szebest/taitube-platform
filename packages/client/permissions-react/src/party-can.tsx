import type { ReactNode } from 'react';
import { type PartyGate, usePartyCan } from './use-party-can';

export interface PartyCanProps {
  gate: PartyGate;
  fallback?: ReactNode;
  children: ReactNode;
}

/** Renders its children only where the viewer's room ability allows the gate. */
export function PartyCan({ gate, fallback, children }: PartyCanProps): ReactNode {
  return usePartyCan(gate) ? children : (fallback ?? null);
}
