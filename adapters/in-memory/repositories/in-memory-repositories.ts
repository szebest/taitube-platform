import type { Repositories } from '@vp/core/ports';
import { InMemoryDlqRepository } from './in-memory-dlq-repository.js';
import { InMemoryEventRepository } from './in-memory-event-repository.js';
import { InMemoryOutboxRepository } from './in-memory-outbox-repository.js';
import { InMemoryRenditionRepository } from './in-memory-rendition-repository.js';
import { InMemoryStepRepository } from './in-memory-step-repository.js';
import { InMemoryUploadRepository } from './in-memory-upload-repository.js';
import { InMemoryUserRepository } from './in-memory-user-repository.js';
import { InMemoryVideoRepository } from './in-memory-video-repository.js';

export class InMemoryRepositories implements Repositories {
  readonly events: InMemoryEventRepository;
  readonly renditions: InMemoryRenditionRepository;
  readonly steps: InMemoryStepRepository;
  readonly users: InMemoryUserRepository;
  readonly videos: InMemoryVideoRepository;
  readonly uploads: InMemoryUploadRepository;
  readonly dlq: InMemoryDlqRepository;
  readonly outbox: InMemoryOutboxRepository;

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
  }
}
