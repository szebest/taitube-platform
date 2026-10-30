import { isErr } from '@vp/result';
import { OWNER_ID, seedOwners } from '../../../__tests__/contract/fixtures';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeRecommendationFeedbackRepositoryContract } from '../../../__tests__/contract/recommendation-feedback-repository.contract';

describeRecommendationFeedbackRepositoryContract(postgresSubject);

describe('PostgresRecommendationFeedbackRepository: the target check', () => {
  it.each([
    { scenario: 'not_interested with no video', kind: 'not_interested' },
    { scenario: 'hide_channel with no channel', kind: 'hide_channel' },
  ] as const)('refuses $scenario', async ({ kind }) => {
    const subject = await postgresSubject();
    try {
      await seedOwners(subject.repositories);

      const refused = await subject.repositories.recommendationFeedback.put({
        id: '00000000-0000-7000-8000-0000000000f1',
        userId: OWNER_ID,
        createdAt: new Date(),
        kind,
      } as never);

      expect(isErr(refused)).toBe(true);
    } finally {
      await subject.close();
    }
  });
});
