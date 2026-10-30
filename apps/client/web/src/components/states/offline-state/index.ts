import {
  OfflineStateAction,
  OfflineStateAvailable,
  OfflineStateDescription,
  OfflineStateLink,
  OfflineStateReconnected,
  OfflineStateRoot,
  OfflineStateTitle,
} from './offline-state';

export const OfflineState = {
  Root: OfflineStateRoot,
  Title: OfflineStateTitle,
  Description: OfflineStateDescription,
  Available: OfflineStateAvailable,
  Link: OfflineStateLink,
  Action: OfflineStateAction,
  Reconnected: OfflineStateReconnected,
};

export { useOfflineState } from './offline-state.context';
export { offlineStateStyles } from './offline-state.variants';
