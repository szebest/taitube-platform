import {
  type AppealRejectionInput,
  type ApproveHeldVideoInput,
  type DismissFlagsInput,
  type EventRepository,
  type HoldVideoInput,
  type ListScreeningCasesOptions,
  type NewScreeningInput,
  type PurgeableEvidenceOptions,
  type RaiseFlagInput,
  type RejectHeldVideoInput,
  type ScreeningAppealRecord,
  type ScreeningCase,
  type ScreeningRecord,
  ScreeningRepository,
  type VideoRepository,
} from '@vp/core/repositories';
import {
  FLAG_ONLY_CHECKSUM,
  SCREENING_TRANSITIONS,
  type ScreeningDecision,
  isScreeningCaseOpen,
  mergeFlag,
} from '@vp/domain';
import { type DatabaseUnavailable, ErrorCodes } from '@vp/errors';
import { type Result, isErr, ok } from '@vp/result';

export interface ScreeningDependencies {
  videos: Pick<VideoRepository, 'findById' | 'transition'>;
  events: EventRepository;
}

export class InMemoryScreeningRepository extends ScreeningRepository {
  private readonly screenings = new Map<string, ScreeningRecord>();
  private readonly appeals: ScreeningAppealRecord[] = [];

  constructor(private readonly deps: ScreeningDependencies) {
    super();
  }

  async record(input: NewScreeningInput): Promise<Result<ScreeningRecord, DatabaseUnavailable>> {
    const stored = this.find(input.videoId, input.sourceChecksum);
    if (stored) return ok(stored);

    const created: ScreeningRecord = {
      ...input,
      decision: null,
      decidedBy: null,
      decidedAt: null,
      decisionNote: null,
      flagsClearedAt: null,
      evidencePurgedAt: null,
      createdAt: new Date(),
    };
    this.screenings.set(created.id, created);
    return ok(created);
  }

  async findByVideo(
    videoId: string,
    sourceChecksum: string
  ): Promise<Result<ScreeningRecord | null, DatabaseUnavailable>> {
    return ok(this.find(videoId, sourceChecksum) ?? null);
  }

  async latestForVideo(
    videoId: string
  ): Promise<Result<ScreeningRecord | null, DatabaseUnavailable>> {
    return ok(this.latest(videoId) ?? null);
  }

  async findAppeals(
    videoId: string
  ): Promise<Result<ScreeningAppealRecord[], DatabaseUnavailable>> {
    return ok(this.appealsOf(videoId));
  }

  async hold(input: HoldVideoInput): Promise<Result<boolean, DatabaseUnavailable>> {
    const { videoId, traceId } = input;
    const edge = SCREENING_TRANSITIONS.hold;
    const screening = this.latest(videoId);

    return this.deps.videos.transition({
      videoId,
      from: edge.from,
      to: edge.to,
      eventType: edge.event,
      eventPayload: {
        screeningId: screening?.id ?? null,
        reasons: screening?.reasons.map((finding) => finding.reason) ?? [],
      },
      traceId,
    });
  }

  async approve(input: ApproveHeldVideoInput): Promise<Result<boolean, DatabaseUnavailable>> {
    const { videoId, moderatorId, outbox } = input;
    const edge = SCREENING_TRANSITIONS.approve;

    const moved = await this.deps.videos.transition({
      videoId,
      from: edge.from,
      to: edge.to,
      eventType: edge.event,
      eventPayload: { moderatorId },
      outbox,
    });
    if (isErr(moved) || !moved.value) return moved;

    this.decide(videoId, { decision: 'approved', moderatorId });
    this.resolveAppeal(videoId, moderatorId);
    return ok(true);
  }

  async reject(input: RejectHeldVideoInput): Promise<Result<boolean, DatabaseUnavailable>> {
    const { videoId, moderatorId, reason } = input;
    const edge = SCREENING_TRANSITIONS.reject;

    const moved = await this.deps.videos.transition({
      videoId,
      from: edge.from,
      to: edge.to,
      eventType: edge.event,
      eventPayload: { moderatorId, reason },
      patch: { errorCode: ErrorCodes.SCREENING_REJECTED },
    });
    if (isErr(moved) || !moved.value) return moved;

    this.decide(videoId, { decision: 'rejected', moderatorId, note: reason });
    this.resolveAppeal(videoId, moderatorId);
    return ok(true);
  }

  async appeal(input: AppealRejectionInput): Promise<Result<boolean, DatabaseUnavailable>> {
    const { id, videoId, authorId, message } = input;
    const edge = SCREENING_TRANSITIONS.appeal;

    const video = await this.deps.videos.findById(videoId);
    const screening = this.latest(videoId);
    if (isErr(video)) return video;
    if (video.value?.errorCode !== ErrorCodes.SCREENING_REJECTED || !screening) return ok(false);

    const moved = await this.deps.videos.transition({
      videoId,
      from: edge.from,
      to: edge.to,
      eventType: edge.event,
      eventPayload: { appealId: id, authorId },
      patch: { errorCode: null },
    });
    if (isErr(moved) || !moved.value) return moved;

    this.appeals.push({
      id,
      videoId,
      screeningId: screening.id,
      authorId,
      message,
      rejectedBy: screening.decidedBy,
      createdAt: new Date(),
      resolvedBy: null,
      resolvedAt: null,
    });
    Object.assign(screening, {
      decision: null,
      decidedBy: null,
      decidedAt: null,
      decisionNote: null,
    });
    return ok(true);
  }

  async dismiss(input: DismissFlagsInput): Promise<Result<boolean, DatabaseUnavailable>> {
    const { videoId, moderatorId } = input;
    const screening = this.latest(videoId);
    if (
      !screening ||
      screening.flags.length === 0 ||
      screening.flagsClearedAt !== null ||
      (screening.outcome === 'HOLD' && screening.decision === null)
    ) {
      return ok(false);
    }

    const logged = await this.deps.events.create({
      videoId,
      type: 'video.screening_dismissed',
      payload: { moderatorId, screeningId: screening.id },
    });
    if (isErr(logged)) return logged;

    const now = new Date();
    Object.assign(screening, {
      flagsClearedAt: now,
      ...(screening.decision === null
        ? { decision: 'dismissed', decidedBy: moderatorId, decidedAt: now }
        : {}),
    });
    return ok(true);
  }

  async raiseFlag(input: RaiseFlagInput): Promise<Result<boolean, DatabaseUnavailable>> {
    const { id, videoId, finding, thresholdVersion } = input;
    const latest = this.latest(videoId);
    if (!latest) {
      await this.record({
        id,
        videoId,
        sourceChecksum: FLAG_ONLY_CHECKSUM,
        outcome: 'PASS',
        score: 0,
        reasons: [],
        flags: [finding],
        modelVersion: null,
        thresholdVersion,
      });
      return ok(true);
    }

    const merged = mergeFlag(latest.flags, finding);
    if (!merged.changed) return ok(false);

    Object.assign(latest, {
      flags: merged.flags,
      flagsClearedAt: null,
      ...(latest.decision === 'dismissed'
        ? { decision: null, decidedBy: null, decidedAt: null }
        : {}),
    });
    return ok(true);
  }

  async listCases(
    options: ListScreeningCasesOptions
  ): Promise<Result<ScreeningCase[], DatabaseUnavailable>> {
    const { cursor, limit, state } = options;
    const key = (screening: ScreeningRecord) =>
      `${isScreeningCaseOpen(screening) ? 1 : 0}|${screening.createdAt.toISOString()}|${screening.id}`;
    const after = cursor
      ? `${cursor.open ? 1 : 0}|${cursor.createdAt.toISOString()}|${cursor.id}`
      : null;

    const cases = [...this.screenings.values()]
      .filter((screening) => screening.outcome === 'HOLD' || screening.flags.length > 0)
      .filter((screening) => {
        const open = isScreeningCaseOpen(screening);
        return state === undefined || (state === 'open') === open;
      })
      .sort((a, b) => (key(a) < key(b) ? 1 : -1))
      .filter((screening) => after === null || key(screening) < after)
      .slice(0, limit + 1)
      .map((screening) => ({
        screening: { ...screening },
        appeal: this.appealsOf(screening.videoId)[0] ?? null,
      }));
    return ok(cases);
  }

  async findPurgeableEvidence(
    options: PurgeableEvidenceOptions
  ): Promise<Result<ScreeningRecord[], DatabaseUnavailable>> {
    const found = [...this.screenings.values()]
      .filter(
        ({ decision, decidedAt, evidencePurgedAt }) =>
          decision !== null &&
          evidencePurgedAt === null &&
          decidedAt !== null &&
          decidedAt < options.closedBefore
      )
      .slice(0, options.limit)
      .map((screening) => ({ ...screening }));
    return ok(found);
  }

  async markEvidencePurged(id: string): Promise<Result<boolean, DatabaseUnavailable>> {
    const screening = this.screenings.get(id);
    if (!screening || screening.evidencePurgedAt !== null) return ok(false);
    screening.evidencePurgedAt = new Date();
    return ok(true);
  }

  clear(): void {
    this.screenings.clear();
    this.appeals.length = 0;
  }

  private appealsOf(videoId: string): ScreeningAppealRecord[] {
    return this.appeals
      .filter((appeal) => appeal.videoId === videoId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  private find(videoId: string, sourceChecksum: string): ScreeningRecord | undefined {
    return [...this.screenings.values()].find(
      (row) => row.videoId === videoId && row.sourceChecksum === sourceChecksum
    );
  }

  private latest(videoId: string): ScreeningRecord | undefined {
    return [...this.screenings.values()].filter((row) => row.videoId === videoId).at(-1);
  }

  private decide(
    videoId: string,
    decision: {
      decision: Extract<ScreeningDecision, 'approved' | 'rejected'>;
      moderatorId: string;
      note?: string;
    }
  ): void {
    const latest = this.latest(videoId);
    if (!latest) return;

    Object.assign(latest, {
      decision: decision.decision,
      decidedBy: decision.moderatorId,
      decidedAt: new Date(),
      decisionNote: decision.note ?? null,
      flagsClearedAt: new Date(),
    });
  }

  private resolveAppeal(videoId: string, moderatorId: string): void {
    for (const appeal of this.appeals) {
      if (appeal.videoId === videoId && appeal.resolvedAt === null) {
        appeal.resolvedBy = moderatorId;
        appeal.resolvedAt = new Date();
      }
    }
  }
}
