import { describeLivePresenceContract } from '../../__tests__/contract/live-presence.contract';
import { redisLivePresenceSubject } from '../../__tests__/contract/redis-subjects';

describeLivePresenceContract(redisLivePresenceSubject);
