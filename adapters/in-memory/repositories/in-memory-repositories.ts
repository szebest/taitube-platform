import type { Repositories } from '@vp/core/ports';
import { InMemoryCategoryRepository } from './in-memory-category-repository';
import { InMemoryChannelRepository } from './in-memory-channel-repository';
import { InMemoryDlqRepository } from './in-memory-dlq-repository';
import { InMemoryEventRepository } from './in-memory-event-repository';
import { InMemoryOutboxRepository } from './in-memory-outbox-repository';
import { InMemoryRenditionRepository } from './in-memory-rendition-repository';
import { InMemoryStepRepository } from './in-memory-step-repository';
import { InMemorySubscriptionRepository } from './in-memory-subscription-repository';
import { InMemoryUploadRepository } from './in-memory-upload-repository';
import { InMemoryUserRepository } from './in-memory-user-repository';
import { InMemoryVideoReactionRepository } from './in-memory-video-reaction-repository';
import { InMemoryVideoRepository } from './in-memory-video-repository';

export class InMemoryRepositories implements Repositories {
  readonly events: InMemoryEventRepository;
  readonly renditions: InMemoryRenditionRepository;
  readonly steps: InMemoryStepRepository;
  readonly users: InMemoryUserRepository;
  readonly videos: InMemoryVideoRepository;
  readonly uploads: InMemoryUploadRepository;
  readonly dlq: InMemoryDlqRepository;
  readonly outbox: InMemoryOutboxRepository;
  readonly categories: InMemoryCategoryRepository;
  readonly channels: InMemoryChannelRepository;
  readonly videoReactions: InMemoryVideoReactionRepository;
  readonly subscriptions: InMemorySubscriptionRepository;

  constructor() {
    this.events = new InMemoryEventRepository();
    this.renditions = new InMemoryRenditionRepository();
    this.steps = new InMemoryStepRepository();
    this.users = new InMemoryUserRepository();
    this.outbox = new InMemoryOutboxRepository();
    this.dlq = new InMemoryDlqRepository(undefined, { outboxRepo: this.outbox });
    this.videos = new InMemoryVideoRepository({
      eventsRepo: this.events,
      renditionsRepo: this.renditions,
      stepsRepo: this.steps,
      outboxRepo: this.outbox,
    });

    this.uploads = new InMemoryUploadRepository({
      videosRepo: this.videos,
    });
    this.categories = new InMemoryCategoryRepository({
      videosRepo: this.videos,
    });
    this.channels = new InMemoryChannelRepository();
    this.videoReactions = new InMemoryVideoReactionRepository({
      videosRepo: this.videos,
    });
    this.subscriptions = new InMemorySubscriptionRepository({
      channelsRepo: this.channels,
      videosRepo: this.videos,
    });
    this.videos.setUploadsRepo(this.uploads);
    this.events.setVideosRepo(this.videos);
    this.dlq.setOutboxRepo(this.outbox);
  }

  clear(): void {
    this.events.clear();
    this.renditions.clear();
    this.steps.clear();
    this.users.clear();
    this.videos.clear();
    this.uploads.clear();
    this.dlq.clear();
    this.outbox.clear();
    this.categories.clear();
    this.channels.clear();
    this.videoReactions.clear();
    this.subscriptions.clear();
  }
}

