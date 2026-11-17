import { createCompoundContext } from '@kit/ui';
import type { PartyRoomLayout } from './types';

export const [PartyRoomContext, usePartyRoom] = createCompoundContext<{
  layout: PartyRoomLayout;
}>('PartyRoom');
