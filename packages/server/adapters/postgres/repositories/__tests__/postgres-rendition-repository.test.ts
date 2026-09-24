import { describeRenditionRepositoryContract } from '../../../__tests__/contract/rendition-repository.contract';
import { postgresSubject } from '../../../__tests__/contract/subjects';

describeRenditionRepositoryContract(postgresSubject);
