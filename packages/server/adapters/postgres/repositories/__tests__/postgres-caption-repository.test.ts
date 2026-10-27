import { describeCaptionRepositoryContract } from '../../../__tests__/contract/caption-repository.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describeCaptionRepositoryContract(postgresSubject);
