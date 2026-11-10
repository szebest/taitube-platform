import type { Container } from '@vp/composition';
import { InMemoryFingerprintRepository } from './in-memory-fingerprint-repository';
import { Repo } from './in-memory-repo-tokens';
import { InMemoryScreeningRepository } from './in-memory-screening-repository';

export function provideScreening(container: Container): Container {
  return container
    .provide(
      Repo.screenings,
      (c) =>
        new InMemoryScreeningRepository({
          videos: c.get(Repo.videos),
          events: c.get(Repo.events),
        })
    )
    .provide(Repo.fingerprints, () => new InMemoryFingerprintRepository());
}
