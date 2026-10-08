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

  it.each([
    { text: '-lofi', restricts: false },
    { text: '-"lo fi"', restricts: false },
    { text: '-lofi -"jazz hop"', restricts: false },
    { text: 'lofi -jazz', restricts: true },
    { text: 'lo-fi', restricts: true },
    { text: 'lofi', restricts: true },
  ])('reads $text as narrowing the search: $restricts', async ({ text, restricts }) => {
    expect(expectOk(await subject.repositories.search.restricts(text))).toBe(restricts);
  });
});
