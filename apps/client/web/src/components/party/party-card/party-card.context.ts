import { createContext, useContext } from 'react';
import type { PartyCardState } from './types';

export const PartyCardContext = createContext<{ state: PartyCardState } | undefined>(undefined);

export function usePartyCard(part: string) {
  const context = useContext(PartyCardContext);
  if (!context) {
    throw new Error(`PartyCard.${part} must be rendered inside PartyCard.Root`);
  }
  return context;
}
