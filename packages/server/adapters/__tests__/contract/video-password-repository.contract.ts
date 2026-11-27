import { expectOk } from '@kit/testing/result';
import type { VideoPasswordRepository } from '@vp/core/repositories';
import { OWNER_ID, publicVideo, seedOwners, VIDEO_IDS } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const HASH = 'scrypt$c2FsdA$aGFzaA';

export function describeVideoPasswordRepositoryContract(
  makeSubject: MakeRepositoriesSubject
): void {
  describe('VideoPasswordRepository contract', () => {
    let subject: RepositoriesSubject;
    let passwords: VideoPasswordRepository;

    const readAll = async () => {
      const { videos } = subject.repositories;
      const byId = expectOk(await videos.findById(VIDEO_IDS.a));
      const detailed = expectOk(await videos.findWithDetails(VIDEO_IDS.a))?.video;
      const [listed] = expectOk(await videos.listByOwner({ ownerId: OWNER_ID, limit: 1 }));
      return { byId, detailed, listed };
    };

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.a }));
      passwords = subject.repositories.videoPasswords;
    });

    it('holds no hash for a video that has none, or that does not exist', async () => {
      expect(expectOk(await passwords.hashOf(VIDEO_IDS.a))).toBeNull();
      expect(expectOk(await passwords.hashOf(VIDEO_IDS.b))).toBeNull();
    });

    it('stores a hash, replaces it and removes it, answering false for a video that is not there', async () => {
      expect(expectOk(await passwords.setHash(VIDEO_IDS.a, HASH))).toBe(true);
      expect(expectOk(await passwords.hashOf(VIDEO_IDS.a))).toBe(HASH);

      expect(expectOk(await passwords.setHash(VIDEO_IDS.a, `${HASH}2`))).toBe(true);
      expect(expectOk(await passwords.hashOf(VIDEO_IDS.a))).toBe(`${HASH}2`);

      expect(expectOk(await passwords.setHash(VIDEO_IDS.a, null))).toBe(true);
      expect(expectOk(await passwords.hashOf(VIDEO_IDS.a))).toBeNull();

      expect(expectOk(await passwords.setHash(VIDEO_IDS.b, HASH))).toBe(false);
      expect(expectOk(await passwords.hashOf(VIDEO_IDS.b))).toBeNull();
    });

    it('shows every other read of the video passwordProtected and never the hash', async () => {
      const unprotected = await readAll();
      for (const video of Object.values(unprotected)) {
        expect(video).toMatchObject({ id: VIDEO_IDS.a, passwordProtected: false });
      }

      expectOk(await passwords.setHash(VIDEO_IDS.a, HASH));
      const protectedReads = await readAll();

      for (const video of Object.values(protectedReads)) {
        expect(video).toMatchObject({ id: VIDEO_IDS.a, passwordProtected: true });
        expect(Object.keys(video ?? {}).filter((key) => /hash/i.test(key))).toEqual([]);
        expect(JSON.stringify(video)).not.toContain(HASH);
      }

      expectOk(await passwords.setHash(VIDEO_IDS.a, null));
      expect((await readAll()).byId).toMatchObject({ passwordProtected: false });
    });
  });
}
