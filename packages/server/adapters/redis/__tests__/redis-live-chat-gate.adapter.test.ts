import { describeLiveChatGateContract } from '../../__tests__/contract/live-chat-gate.contract';
import { redisLiveChatGateSubject } from '../../__tests__/contract/redis-subjects';

describeLiveChatGateContract(redisLiveChatGateSubject);
