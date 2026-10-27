import {
  type CaptionCommit,
  type CaptionRecord,
  CaptionRepository,
  type CaptionSettings,
  type ChannelRepositoryPort,
  type CompleteGeneratedTrack,
  type EditCueText,
  type EventRepository,
  type FailGeneratedTrack,
  type NewGeneratedTrack,
  type RegenerateTrack,
  type UploadTrack,
  type UserEventRepository,
  type VideoRepository,
} from '@vp/core/repositories';
import {
  captionsFailed,
  captionsReady,
  isGeneratedTrack,
  type TranscriptCue,
  type UserEvent,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { isErr, ok, type Result } from '@vp/result';
import { searchTokens } from './search-text';

export interface CaptionDependencies {
  videos: Pick<VideoRepository, 'findById'>;
  channels: Pick<ChannelRepositoryPort, 'findByUserId'>;
  events: EventRepository;
  userEvents: UserEventRepository;
}

type CaptionEvent = `captions.${string}`;

const stale: CaptionCommit = { type: 'stale' };

export class InMemoryCaptionRepository extends CaptionRepository {
  private readonly tracks = new Map<string, CaptionRecord>();
  private readonly cueSets = new Map<string, TranscriptCue[]>();
  private readonly videoSwitches = new Map<string, boolean | null>();
  private readonly channelDefaults = new Map<string, boolean>();

  constructor(private readonly deps: CaptionDependencies) {
    super();
  }

  async settings(videoId: string): Promise<Result<CaptionSettings | null, DatabaseUnavailable>> {
    const video = await this.deps.videos.findById(videoId);
    if (isErr(video)) return video;
    if (!video.value) return ok(null);

    const { ownerId } = video.value;
    return ok({
      videoId,
      ownerId,
      autoCaptions: this.videoSwitches.get(videoId) ?? null,
      channelDefault: this.channelDefaults.get(ownerId) ?? false,
    });
  }

  async setAutoCaptions(
    videoId: string,
    autoCaptions: boolean | null
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const video = await this.deps.videos.findById(videoId);
    if (isErr(video)) return video;
    if (!video.value) return ok(false);

    this.videoSwitches.set(videoId, autoCaptions);
    return ok(true);
  }

  async setChannelDefault(
    ownerId: string,
    enabled: boolean
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const channel = await this.deps.channels.findByUserId(ownerId);
    if (isErr(channel)) return channel;
    if (!channel.value) return ok(false);

    this.channelDefaults.set(ownerId, enabled);
    return ok(true);
  }

  async list(videoId: string): Promise<Result<CaptionRecord[], DatabaseUnavailable>> {
    return ok(
      this.ofVideo(videoId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((track) => ({ ...track }))
    );
  }

  async findById(id: string): Promise<Result<CaptionRecord | null, DatabaseUnavailable>> {
    return ok(this.copy(this.tracks.get(id)));
  }

  async findGenerated(videoId: string): Promise<Result<CaptionRecord | null, DatabaseUnavailable>> {
    return ok(this.copy(this.ofVideo(videoId).find(isGeneratedTrack)));
  }

  async findByLanguage(
    videoId: string,
    language: string
  ): Promise<Result<CaptionRecord | null, DatabaseUnavailable>> {
    return ok(this.copy(this.ofVideo(videoId).find((track) => track.language === language)));
  }

  async createGenerated(
    input: NewGeneratedTrack
  ): Promise<Result<CaptionRecord, DatabaseUnavailable>> {
    const existing = this.ofVideo(input.videoId).find(isGeneratedTrack);
    if (existing) return ok({ ...existing });

    const now = new Date();
    const track: CaptionRecord = {
      ...input,
      detectedLanguage: null,
      kind: 'auto',
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    this.tracks.set(track.id, track);
    return ok({ ...track });
  }

  async complete(
    input: CompleteGeneratedTrack
  ): Promise<Result<CaptionCommit, DatabaseUnavailable>> {
    const current = this.at(input.id, input.expectedVersion);
    if (!current) return ok(stale);
    const taken = this.ofVideo(current.videoId).some(
      (track) => track.id !== input.id && track.language === input.language
    );
    if (taken) return ok({ type: 'language-taken' });

    const track = this.change(current, {
      status: 'ready',
      language: input.language,
      detectedLanguage: input.detectedLanguage,
      reason: null,
    });
    this.cueSets.set(
      track.id,
      input.cues.map((cue) => ({ ...cue }))
    );
    return this.record(
      'captions.ready',
      track,
      captionsReady(track.videoId, { id: track.id, language: input.language, kind: track.kind })
    );
  }

  async fail(input: FailGeneratedTrack): Promise<Result<CaptionCommit, DatabaseUnavailable>> {
    const current = this.at(input.id, input.expectedVersion);
    if (!current) return ok(stale);

    const track = this.change(current, { status: input.status, reason: input.reason });
    return this.record(
      `captions.${input.status}`,
      track,
      input.status === 'failed' ? captionsFailed(track.videoId, track.id, input.reason) : undefined
    );
  }

  async regenerate(input: RegenerateTrack): Promise<Result<CaptionCommit, DatabaseUnavailable>> {
    const current = this.at(input.id, input.expectedVersion);
    if (!current) return ok(stale);

    const track = this.change(current, {
      kind: 'auto',
      status: 'pending',
      language: input.language,
      detectedLanguage: null,
      modelVersion: input.modelVersion,
      reason: null,
    });
    return this.record('captions.requested', track);
  }

  async upload(input: UploadTrack): Promise<Result<CaptionCommit, DatabaseUnavailable>> {
    const uploaded = {
      kind: 'uploaded',
      status: 'ready',
      detectedLanguage: null,
      modelVersion: null,
      reason: null,
    } as const;
    const existing = this.ofVideo(input.videoId).find((track) => track.language === input.language);
    const now = new Date();
    const track = existing
      ? this.change(existing, uploaded)
      : this.store({
          id: input.id,
          videoId: input.videoId,
          language: input.language,
          ...uploaded,
          version: 1,
          createdAt: now,
          updatedAt: now,
        });
    this.cueSets.set(
      track.id,
      input.cues.map((cue) => ({ ...cue }))
    );
    return this.record(
      'captions.uploaded',
      track,
      captionsReady(track.videoId, { id: track.id, language: input.language, kind: 'uploaded' })
    );
  }

  async editCues(input: EditCueText): Promise<Result<CaptionCommit, DatabaseUnavailable>> {
    const current = this.at(input.id, input.expectedVersion);
    if (!current) return ok(stale);

    const edits = new Map(input.cues.map(({ index, text }) => [index, text]));
    this.cueSets.set(
      input.id,
      (this.cueSets.get(input.id) ?? []).map((cue) => ({
        ...cue,
        text: edits.get(cue.index) ?? cue.text,
      }))
    );
    const track = this.change(current, { kind: current.kind === 'auto' ? 'edited' : current.kind });
    return this.record('captions.edited', track);
  }

  async delete(id: string): Promise<Result<boolean, DatabaseUnavailable>> {
    this.cueSets.delete(id);
    return ok(this.tracks.delete(id));
  }

  async cues(
    captionId: string,
    query?: string
  ): Promise<Result<TranscriptCue[], DatabaseUnavailable>> {
    const wanted = searchTokens(query ?? '');
    const matching = (this.cueSets.get(captionId) ?? []).filter((cue) => {
      const words = new Set(searchTokens(cue.text));
      return wanted.every((word) => words.has(word));
    });
    return ok(matching.sort((a, b) => a.index - b.index).map((cue) => ({ ...cue })));
  }

  async listStalePending(
    olderThanMs: number,
    limit: number
  ): Promise<Result<CaptionRecord[], DatabaseUnavailable>> {
    const cutoff = Date.now() - olderThanMs;
    const stalled = [...this.tracks.values()]
      .filter(
        (track) =>
          track.status === 'pending' &&
          isGeneratedTrack(track) &&
          track.updatedAt.getTime() < cutoff
      )
      .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
    return ok(stalled.slice(0, limit).map((track) => ({ ...track })));
  }

  clear(): void {
    this.tracks.clear();
    this.cueSets.clear();
    this.videoSwitches.clear();
    this.channelDefaults.clear();
  }

  private ofVideo(videoId: string): CaptionRecord[] {
    return [...this.tracks.values()].filter((track) => track.videoId === videoId);
  }

  private copy(track: CaptionRecord | undefined): CaptionRecord | null {
    return track ? { ...track } : null;
  }

  private at(id: string, expectedVersion: number): CaptionRecord | undefined {
    const track = this.tracks.get(id);
    return track?.version === expectedVersion ? track : undefined;
  }

  private store(track: CaptionRecord): CaptionRecord {
    this.tracks.set(track.id, track);
    return track;
  }

  private change(track: CaptionRecord, changes: Partial<CaptionRecord>): CaptionRecord {
    return this.store({ ...track, ...changes, version: track.version + 1, updatedAt: new Date() });
  }

  private async record(
    type: CaptionEvent,
    track: CaptionRecord,
    announcement?: UserEvent
  ): Promise<Result<CaptionCommit, DatabaseUnavailable>> {
    const logged = await this.deps.events.create({
      videoId: track.videoId,
      type,
      payload: { captionId: track.id, language: track.language, reason: track.reason },
    });
    if (isErr(logged)) return logged;
    if (!announcement) return ok({ type: 'committed', track: { ...track } });

    const video = await this.deps.videos.findById(track.videoId);
    if (isErr(video)) return video;
    if (video.value) {
      const announced = await this.deps.userEvents.append({
        userId: video.value.ownerId,
        ...announcement,
      });
      if (isErr(announced)) return announced;
    }
    return ok({ type: 'committed', track: { ...track } });
  }
}
