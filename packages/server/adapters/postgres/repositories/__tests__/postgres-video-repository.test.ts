import type { NewOutboxInput } from '@vp/core/repositories';
import { expectErr, expectOk } from '@vp/testing/result';
import { OWNER_ID, publicVideo, seedOwners, VIDEO_IDS } from '../../../__tests__/contract/fixtures';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import type { RepositoriesSubject } from '../../../__tests__/contract/subjects';
import { describeVideoRepositoryContract } from '../../../__tests__/contract/video-repository.contract';

describeVideoRepositoryContract(postgresSubject);

describe('PostgresVideoRepository: one transaction per transition', () => {
  let subject: RepositoriesSubject;

  const probeEntry: NewOutboxInput = {
    id: '00000000-0000-7000-8000-000000000801',
    kind: 'job.enqueue',
    payload: { type: 'queue', queueName: 'probe', job: { name: 'probe', data: {} } },
  };

  beforeAll(async () => {
    subject = await postgresSubject();
  });

  afterAll(async () => {
    await subject.close();
  });

  it('announces nothing when the transition rolls back', async () => {
    const { videos, outbox, userEvents } = subject.repositories;
    await seedOwners(subject.repositories);
    expectOk(await videos.create(publicVideo({ id: VIDEO_IDS.a, status: 'UPLOADING' })));
    expectOk(await outbox.enqueue(probeEntry));

    expectErr(
      await videos.transition({
        videoId: VIDEO_IDS.a,
        from: 'UPLOADING',
        to: 'UPLOADED',
        eventType: 'upload.completed',
        outbox: probeEntry,
      })
    );

    expect(expectOk(await videos.findById(VIDEO_IDS.a))?.status).toBe('UPLOADING');
    expect(expectOk(await userEvents.listFrom(OWNER_ID, 0, 10))).toEqual([]);
  });
});
