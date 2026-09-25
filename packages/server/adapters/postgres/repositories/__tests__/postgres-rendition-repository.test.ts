import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeRenditionRepositoryContract } from '../../../__tests__/contract/rendition-repository.contract';

describeRenditionRepositoryContract(postgresSubject);
