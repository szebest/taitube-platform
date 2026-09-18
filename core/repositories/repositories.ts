import type { CategoryRepositoryPort } from './category-repository.port';
import type { ChannelRepositoryPort } from './channel-repository.port';
import type { DlqRepository } from './dlq-repository';
import type { EventRepository } from './event-repository';
import type { OutboxRepository } from './outbox-repository';
import type { RenditionRepository } from './rendition-repository';
import type { StepRepository } from './step-repository';
import type { UploadRepository } from './upload-repository';
import type { UserRepository } from './user-repository';
import type { VideoReactionRepositoryPort } from './video-reaction-repository.port';
import type { VideoRepository } from './video-repository';

export interface Repositories {
  videos: VideoRepository;
  uploads: UploadRepository;
  steps: StepRepository;
  renditions: RenditionRepository;
  events: EventRepository;
  users: UserRepository;
  dlq: DlqRepository;
  outbox: OutboxRepository;
  categories: CategoryRepositoryPort;
  channels: ChannelRepositoryPort;
  videoReactions: VideoReactionRepositoryPort;
}
