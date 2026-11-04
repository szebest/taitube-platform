import { describeLiveStreamRepositoryContract } from '../../../__tests__/contract/live-stream-repository.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describeLiveStreamRepositoryContract(postgresSubject);
