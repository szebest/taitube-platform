import type { VideoRepository } from '@vp/core/repositories';
import type { RepositoriesSubject } from './subjects';

export interface VideoContractContext {
  readonly subject: RepositoriesSubject;
  readonly videos: VideoRepository;
}
