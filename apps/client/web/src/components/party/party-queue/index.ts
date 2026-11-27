import {
  PartyQueueAdd,
  PartyQueueEmpty,
  PartyQueueItem,
  PartyQueueList,
  PartyQueueRoot,
} from './party-queue';

export const PartyQueue = {
  Root: PartyQueueRoot,
  List: PartyQueueList,
  Item: PartyQueueItem,
  Empty: PartyQueueEmpty,
  Add: PartyQueueAdd,
};
export type { PartyQueueItemProps } from './party-queue';
