import { token } from '@kit/composition';
import type { WatchPartyMetrics } from '@vp/pipeline-metrics';
import type { PatternHub } from '../services/pattern-hub';
import type { Poller } from '../services/poller';
import type {
  BufferingWait,
  OwnerGrace,
  Reaction,
  RoomBatcher,
  RoomEnvelope,
  RosterChange,
  WatchPartyBroadcaster,
  WatchPartyContextLoader,
  WatchPartySocketService,
  WatchPartyService,
  WatchPartyGuestService,
  WatchPartyRoleService,
  WatchPartyMemberService,
  WatchPartyQueueService,
  WatchPartyInviteService,
  WatchPartyControlsService,
} from '../services/watch-party/index';
import type { VoiceEnforcement, WatchPartyVoiceService } from '../services/watch-party/voice/index';

export interface WatchPartyServiceSet {
  watchPartyService: WatchPartyService;
  watchPartyGuestService: WatchPartyGuestService;
  watchPartyRoleService: WatchPartyRoleService;
  watchPartyMemberService: WatchPartyMemberService;
  watchPartyQueueService: WatchPartyQueueService;
  watchPartyInviteService: WatchPartyInviteService;
  watchPartyControlsService: WatchPartyControlsService;
  watchPartySocketService: WatchPartySocketService;
  /** `null` while `WATCH_PARTY_VOICE_ENABLED` is off: the voice routes are not registered. */
  watchPartyVoiceService: WatchPartyVoiceService | null;
}

export const WatchPartyServices = {
  WatchPartyBroadcaster: token<WatchPartyBroadcaster>('WatchPartyBroadcaster'),
  WatchPartyContextLoader: token<WatchPartyContextLoader>('WatchPartyContextLoader'),
  WatchPartyService: token<WatchPartyService>('WatchPartyService'),
  WatchPartyGuestService: token<WatchPartyGuestService>('WatchPartyGuestService'),
  WatchPartyRoleService: token<WatchPartyRoleService>('WatchPartyRoleService'),
  WatchPartyMemberService: token<WatchPartyMemberService>('WatchPartyMemberService'),
  WatchPartyQueueService: token<WatchPartyQueueService>('WatchPartyQueueService'),
  WatchPartyInviteService: token<WatchPartyInviteService>('WatchPartyInviteService'),
  WatchPartyControlsService: token<WatchPartyControlsService>('WatchPartyControlsService'),
  WatchPartyHub: token<PatternHub<RoomEnvelope>>('WatchPartyHub'),
  WatchPartySweep: token<Poller>('WatchPartySweep'),
  WatchPartyMetrics: token<WatchPartyMetrics>('WatchPartyMetrics'),
  WatchPartyReactions: token<RoomBatcher<Reaction>>('WatchPartyReactions'),
  WatchPartyRoster: token<RoomBatcher<RosterChange>>('WatchPartyRoster'),
  WatchPartyBuffering: token<BufferingWait>('WatchPartyBuffering'),
  WatchPartyOwnerGrace: token<OwnerGrace>('WatchPartyOwnerGrace'),
  WatchPartySocketService: token<WatchPartySocketService>('WatchPartySocketService'),
  WatchPartyVoiceEnforcement: token<VoiceEnforcement>('WatchPartyVoiceEnforcement'),
  WatchPartyVoiceService: token<WatchPartyVoiceService>('WatchPartyVoiceService'),
};
