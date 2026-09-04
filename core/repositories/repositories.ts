import type { EventRepository } from './event-repository.js';
import type { RenditionRepository } from './rendition-repository.js';
import type { StepRepository } from './step-repository.js';
import type { UploadRepository } from './upload-repository.js';
import type { UserRepository } from './user-repository.js';
import type { VideoRepository } from './video-repository.js';

export interface Repositories {
  videos: VideoRepository;
  uploads: UploadRepository;
  steps: StepRepository;
  renditions: RenditionRepository;
  events: EventRepository;
  users: UserRepository;
}
