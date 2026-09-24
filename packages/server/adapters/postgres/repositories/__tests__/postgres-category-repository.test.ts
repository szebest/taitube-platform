import { describeCategoryRepositoryContract } from '../../../__tests__/contract/category-repository.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describeCategoryRepositoryContract(postgresSubject);
