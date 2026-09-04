import type {
  RenditionRecord,
  Repositories,
  UploadRecord,
  UserRecord,
  VideoEventRecord,
  VideoRecord,
} from '@vp/core/ports';
import { InMemoryEventRepository } from './in-memory-event-repository.js';
import { InMemoryRenditionRepository } from './in-memory-rendition-repository.js';
import { InMemoryStepRepository } from './in-memory-step-repository.js';
import { InMemoryUploadRepository } from './in-memory-upload-repository.js';
import { InMemoryUserRepository } from './in-memory-user-repository.js';
import { InMemoryVideoRepository } from './in-memory-video-repository.js';
import type { InternalStep } from './types.js';

export class InMemoryRepositories implements Repositories {
  readonly videos: InMemoryVideoRepository;
  readonly uploads: InMemoryUploadRepository;
  readonly steps: InMemoryStepRepository;
  readonly renditions: InMemoryRenditionRepository;
  readonly events: InMemoryEventRepository;
  readonly users: InMemoryUserRepository;

  private readonly videosMap = new Map<string, VideoRecord>();
  private readonly uploadsMap = new Map<string, UploadRecord>();
  private readonly renditionsMap = new Map<string, RenditionRecord>();
  private readonly stepsMap = new Map<string, InternalStep>();
  private readonly eventsList: VideoEventRecord[] = [];
  private readonly usersMap = new Map<string, UserRecord>();

  constructor() {
    // Seed dev users
    this.usersMap.set('00000000-0000-7000-8000-000000000001', {
      id: '00000000-0000-7000-8000-000000000001',
      email: 'dev@video-pipeline.local',
      tier: 'pro',
      maxConcurrentUploads: 10,
      maxVideoDurationSec: 3600,
      storageQuotaBytes: 100 * 1024 * 1024 * 1024,
      webhookUrl: null,
      createdAt: new Date(),
    });
    this.usersMap.set('00000000-0000-7000-8000-000000000002', {
      id: '00000000-0000-7000-8000-000000000002',
      email: 'user@video-pipeline.local',
      tier: 'free',
      maxConcurrentUploads: 2,
      maxVideoDurationSec: 300,
      storageQuotaBytes: 1024 * 1024 * 1024,
      webhookUrl: null,
      createdAt: new Date(),
    });
    this.usersMap.set('00000000-0000-7000-8000-000000000003', {
      id: '00000000-0000-7000-8000-000000000003',
      email: 'admin@video-pipeline.local',
      tier: 'enterprise',
      maxConcurrentUploads: 50,
      maxVideoDurationSec: 14400,
      storageQuotaBytes: 1024 * 1024 * 1024 * 1024,
      webhookUrl: null,
      createdAt: new Date(),
    });

    this.videos = new InMemoryVideoRepository(
      this.videosMap,
      this.eventsList,
      this.renditionsMap,
      this.stepsMap,
      this.uploadsMap
    );
    this.uploads = new InMemoryUploadRepository(this.uploadsMap, this.videosMap);
    this.steps = new InMemoryStepRepository(this.stepsMap);
    this.renditions = new InMemoryRenditionRepository(this.renditionsMap);
    this.events = new InMemoryEventRepository(this.eventsList);
    this.users = new InMemoryUserRepository(this.usersMap);
  }

  clear(): void {
    this.videosMap.clear();
    this.uploadsMap.clear();
    this.renditionsMap.clear();
    this.stepsMap.clear();
    this.eventsList.length = 0;
  }
}
