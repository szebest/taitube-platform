import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeWebhookRepositoryContract } from '../../../__tests__/contract/webhook-repository.contract';

describeWebhookRepositoryContract(postgresSubject);
