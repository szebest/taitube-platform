import { expectOk } from '@vp/testing/result';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeSearchRepositoryContract } from '../../../__tests__/contract/search-repository.contract';
import type { RepositoriesSubject } from '../../../__tests__/contract/subjects';

describeSearchRepositoryContract(postgresSubject);

describe('PostgresSearchRepository', () => {
  let subject: RepositoriesSubject;

  beforeAll(async () => {
    subject = await postgresSubject();
  });

  afterAll(async () => {
    await subject.close();
  });

  it.each(['-lofi', '-"lo fi"', '-lofi -"jazz hop"'])(
    'reads %j, which excludes and never includes, as matching everything',
    async (text) => {
      expect(expectOk(await subject.repositories.search.restricts(text))).toBe(false);
    }
  );
});
