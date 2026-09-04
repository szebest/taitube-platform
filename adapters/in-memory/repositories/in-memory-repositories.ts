import type { Repositories } from '@vp/core/ports';
import { InMemoryDlqRepository } from './in-memory-dlq-repository.js';
import { InMemoryEventRepository } from './in-memory-event-repository.js';
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

  constructor() {
    this.events = new InMemoryEventRepository();
    this.renditions = new InMemoryRenditionRepository();
    this.steps = new InMemoryStepRepository();
    this.users = new InMemoryUserRepository();
    this.dlq = new InMemoryDlqRepository();
    this.videos = new InMemoryVideoRepository({
      eventsRepo: this.events,
      renditionsRepo: this.renditions,
      stepsRepo: this.steps,
    });
    this.uploads = new InMemoryUploadRepository({
      videosRepo: this.videos,
    });
    this.videos.setUploadsRepo(this.uploads);
    this.events.setVideosRepo(this.videos);
  }

  clear(): void {
    this.events.clear();
    this.renditions.clear();
    this.steps.clear();
    this.users.clear();
    this.videos.clear();
    this.uploads.clear();
    this.dlq.clear();
  }
}
