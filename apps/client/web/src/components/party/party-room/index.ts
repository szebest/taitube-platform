import {
  PartyRoomHeader,
  PartyRoomOverlay,
  PartyRoomPanel,
  PartyRoomRoot,
  PartyRoomStage,
  PartyRoomTabPanel,
  PartyRoomTabs,
} from './party-room';

export const PartyRoom = {
  Root: PartyRoomRoot,
  Header: PartyRoomHeader,
  Stage: PartyRoomStage,
  Overlay: PartyRoomOverlay,
  Panel: PartyRoomPanel,
  Tabs: PartyRoomTabs,
  TabPanel: PartyRoomTabPanel,
};
export type { PartyRoomPanelProps, PartyRoomRootProps } from './party-room';
export { usePartyRoom } from './party-room.context';
export { partyRoomStyles } from './party-room.variants';
export type { PartyRoomLayout, PartyRoomTab } from './types';
