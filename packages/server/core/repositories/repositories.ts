import type { CategoryRepositoryPort } from './category-repository';
import type { ChannelRepositoryPort } from './channel-repository';
import type { CommentRepositoryPort } from './comment-repository';
import type { DlqRepository } from './dlq-repository';
import type { EventRepository } from './event-repository';
import type { OutboxRepository } from './outbox-repository';
import type { RenditionRepository } from './rendition-repository';
import type { StepRepository } from './step-repository';
import type { SubscriptionRepositoryPort } from './subscription-repository';
import type { UploadRepository } from './upload-repository';
import type { UserRepository } from './user-repository';
import type { VideoReactionRepositoryPort } from './video-reaction-repository';
import type { VideoRepository } from './video-repository';
import type { VideoViewRepositoryPort } from './video-view-repository';

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
  subscriptions: SubscriptionRepositoryPort;
  videoViews: VideoViewRepositoryPort;
  comments: CommentRepositoryPort;
}
