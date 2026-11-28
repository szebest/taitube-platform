import { expectOk } from '@kit/testing/result';
import type { EndScreenDraft } from '@vp/core/repositories';
import { publicVideo, seedOwners, VIDEO_IDS } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const { a, b } = VIDEO_IDS;

function draft(overrides: Partial<EndScreenDraft> = {}): EndScreenDraft {
  return {
    videoId: a,
    layout: 'grid',
    startsAtMs: 100_000,
    items: [{ type: 'content', ref: { type: 'video', id: b } }, { type: 'next_episode' }],
    showSubscribe: true,
    ...overrides,
  };
}

export function describeVideoEndScreenRepositoryContract(
  makeSubject: MakeRepositoriesSubject
): void {
  describe('VideoEndScreenRepository contract', () => {
    let subject: RepositoriesSubject;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      for (const id of [a, b]) await subject.repositories.videos.create(publicVideo({ id }));
    });

    it('has no end screen until one is saved', async () => {
      expect(expectOk(await subject.repositories.videoEndScreens.find(a))).toBeNull();
    });

    it('saves a first end screen at version 1 and bumps the version on each replace', async () => {
      const { videoEndScreens: screens } = subject.repositories;

      const first = expectOk(await screens.replace(draft(), 0));
      const second = expectOk(await screens.replace(draft({ layout: 'hero', items: [] }), 1));

      expect(first).toEqual({ ...draft(), version: 1 });
      expect(second).toMatchObject({ layout: 'hero', items: [], version: 2 });
      expect(expectOk(await screens.find(a))).toEqual(second);
    });

    it.each([
      { scenario: 'a first save over an existing one', expected: 0 },
      { scenario: 'a replace on an old version', expected: 5 },
    ])('answers null for $scenario', async ({ expected }) => {
      const { videoEndScreens: screens } = subject.repositories;
      expectOk(await screens.replace(draft(), 0));

      expect(expectOk(await screens.replace(draft({ layout: 'row' }), expected))).toBeNull();
      expect(expectOk(await screens.find(a))).toMatchObject({ layout: 'grid', version: 1 });
    });
  });
}
