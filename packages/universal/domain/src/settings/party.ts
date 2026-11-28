import { PARTY_ROOM_LAYOUTS } from '../watch-party';
import { choice, defineSection, flag, type SectionValues } from './define';

/** How a viewer sees a watch party: kept on the device cookie so the page renders in it on first paint. */
export const PARTY_SETTINGS = defineSection({
  layout: choice({
    options: PARTY_ROOM_LAYOUTS,
    default: 'side',
    scope: 'both',
    device: 'cookie',
  }),
  chatOverlay: flag({ default: true, scope: 'both', device: 'cookie' }),
  reactionOverlay: flag({ default: true, scope: 'both', device: 'cookie' }),
  systemLines: flag({ default: true, scope: 'both', device: 'cookie' }),
});

export type PartyPreferences = SectionValues<typeof PARTY_SETTINGS>;
