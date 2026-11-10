import { createCompoundContext } from '@vp/ui';
import type { PartyRoomLayout } from './types';

export const [PartyRoomContext, usePartyRoom] = createCompoundContext<{
  layout: PartyRoomLayout;
}>('PartyRoom');
