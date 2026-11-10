import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeScreeningCases } from '../../../__tests__/contract/screening-cases.contract';
import type { RepositoriesSubject } from '../../../__tests__/contract/subjects';

describe('screening queries over Postgres', () => {
  let subject: RepositoriesSubject;

  beforeAll(async () => {
    subject = await postgresSubject();
  });

  afterAll(async () => {
    await subject.close();
  });

  beforeEach(async () => {
    await subject.reset();
    const { seedOwners } = await import('../../../__tests__/contract/fixtures');
    await seedOwners(subject.repositories);
  });

  describeScreeningCases(() => subject);
});
