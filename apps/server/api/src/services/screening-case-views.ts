import type {
  ScreeningCaseView,
  ScreeningFindingView,
  ScreeningMatchedVideoView,
} from '@vp/api-contracts';
import type { StorageClient } from '@vp/core/ports';
import type {
  ChannelRepositoryPort,
  ScreeningCase,
  VideoRecord,
  VideoRepository,
} from '@vp/core/repositories';
import { type ScreeningFinding, isScreeningCaseOpen } from '@vp/domain';
import type { CdnBase } from '@vp/env-schema';
import type { DatabaseUnavailable, StorageUnavailable } from '@vp/errors';
import { type Result, isErr, ok } from '@vp/result';
import { z } from 'zod';
import { type ChannelOf, loadChannelsOf, thumbnailUrl } from './video-views';

export interface ScreeningCaseViewsDeps {
  videos: VideoRepository;
  channels: ChannelRepositoryPort;
  storage: StorageClient;
  rawBucket: string;
  /** How long a signed frame URL stays valid. */
  frameUrlTtlSeconds: number;
  cdn: CdnBase;
}

export type ScreeningCaseViewFailure = DatabaseUnavailable | StorageUnavailable;

/** Evidence is stored as loose JSON, so each field is read on its own and a bad one reads as absent. */
function lenient<T extends z.ZodType>(schema: T) {
  return z
    .unknown()
    .transform((value): z.infer<T> | undefined => {
      const read = schema.safeParse(value);
      return read.success ? read.data : undefined;
    })
    .optional();
}

const number = lenient(z.number());

const EvidenceSchema = z.looseObject({
  matchedVideoId: lenient(z.string()),
  sameChannel: lenient(z.boolean()),
  video: lenient(
    z
      .looseObject({
        coverage: number,
        runFromSeconds: number,
        runToSeconds: number,
        offsetSeconds: number,
        mirrored: lenient(z.boolean()),
      })
      .nullable()
  ),
  audio: lenient(
    z.looseObject({ coverage: number, runFromSeconds: number, runToSeconds: number }).nullable()
  ),
  frames: lenient(
    z.array(z.object({ key: z.string(), timestampSeconds: z.number(), score: z.number() }))
  ),
  share: number,
  signals: lenient(z.array(z.string())),
  profanity: lenient(z.array(z.string())),
});
type Evidence = z.infer<typeof EvidenceSchema>;

function readEvidence(stored: Readonly<Record<string, unknown>>): Evidence {
  const read = EvidenceSchema.safeParse(stored);
  return read.success ? read.data : {};
}

function rangeOf(from: number | undefined, to: number | undefined, offset = 0) {
  return from === undefined || to === undefined
    ? null
    : { fromSeconds: from + offset, toSeconds: to + offset };
}

/** What a moderator reads for a queue page: the cases with their videos, matches and signed frames. */
export class ScreeningCaseViews {
  constructor(private readonly deps: ScreeningCaseViewsDeps) {}

  async toViews(
    cases: readonly ScreeningCase[]
  ): Promise<Result<ScreeningCaseView[], ScreeningCaseViewFailure>> {
    const evidenceOf = new Map(
      cases.flatMap(({ screening }) =>
        [...screening.reasons, ...screening.flags].map(
          (finding) => [finding, readEvidence(finding.evidence)] as const
        )
      )
    );
    const wanted = new Set([
      ...cases.map(({ screening }) => screening.videoId),
      ...[...evidenceOf.values()].flatMap(({ matchedVideoId }) =>
        matchedVideoId ? [matchedVideoId] : []
      ),
    ]);

    const found = await Promise.all([...wanted].map((id) => this.deps.videos.findById(id)));
    const videos = new Map<string, VideoRecord>();
    for (const result of found) {
      if (isErr(result)) return result;
      if (result.value) videos.set(result.value.id, result.value);
    }
    const channelOf = await loadChannelsOf(this.deps.channels, [
      ...new Set([...videos.values()].map((video) => video.ownerId)),
    ]);
    if (isErr(channelOf)) return channelOf;

    const frameUrls = await this.signFrames(
      cases.filter(({ screening }) => screening.evidencePurgedAt === null),
      evidenceOf
    );
    if (isErr(frameUrls)) return frameUrls;

    const finding = (item: ScreeningFinding): ScreeningFindingView => {
      const evidence = evidenceOf.get(item) ?? {};
      const matched = evidence.matchedVideoId ? videos.get(evidence.matchedVideoId) : undefined;
      return {
        reason: item.reason,
        score: item.score,
        match: evidence.matchedVideoId
          ? this.matchView(evidence.matchedVideoId, evidence, matched, channelOf.value)
          : null,
        frames: (evidence.frames ?? []).flatMap(({ key, timestampSeconds, score }) => {
          const url = frameUrls.value.get(key);
          return url ? [{ url, timestampSeconds, score }] : [];
        }),
        flaggedShare: evidence.share ?? null,
        signals: evidence.signals ?? [],
        profanity: evidence.profanity ?? [],
      };
    };

    return ok(
      cases.map(({ screening, appeal }) => {
        const video = videos.get(screening.videoId);
        return {
          id: screening.id,
          videoId: screening.videoId,
          title: video?.title ?? null,
          status: video?.status ?? 'DELETED',
          channel: video ? channelOf.value(video.ownerId) : null,
          thumbnailUrl: video ? thumbnailUrl(video, this.deps.cdn) : undefined,
          outcome: screening.outcome,
          score: screening.score,
          open: isScreeningCaseOpen(screening),
          reasons: screening.reasons.map(finding),
          flags: screening.flags.map(finding),
          decision: screening.decision,
          decidedBy: screening.decidedBy,
          decidedAt: screening.decidedAt?.toISOString() ?? null,
          decisionNote: screening.decisionNote,
          appeal: appeal && {
            id: appeal.id,
            message: appeal.message,
            createdAt: appeal.createdAt.toISOString(),
            rejectedBy: appeal.rejectedBy,
            resolvedAt: appeal.resolvedAt?.toISOString() ?? null,
          },
          modelVersion: screening.modelVersion,
          thresholdVersion: screening.thresholdVersion,
          createdAt: screening.createdAt.toISOString(),
        };
      })
    );
  }

  /** The frames of cases whose evidence is still kept, each signed once. */
  private async signFrames(
    cases: readonly ScreeningCase[],
    evidenceOf: ReadonlyMap<ScreeningFinding, Evidence>
  ): Promise<Result<Map<string, string>, StorageUnavailable>> {
    const keys = new Set(
      cases.flatMap(({ screening }) =>
        [...screening.reasons, ...screening.flags].flatMap((finding) =>
          (evidenceOf.get(finding)?.frames ?? []).map(({ key }) => key)
        )
      )
    );

    const urls = new Map<string, string>();
    for (const key of keys) {
      const url = await this.deps.storage.createPresignedGetUrl({
        bucket: this.deps.rawBucket,
        key,
        expiresInSeconds: this.deps.frameUrlTtlSeconds,
      });
      if (isErr(url)) return url;
      urls.set(key, url.value);
    }
    return ok(urls);
  }

  private matchView(
    id: string,
    { sameChannel, video, audio }: Evidence,
    matched: VideoRecord | undefined,
    channelOf: ChannelOf
  ): ScreeningMatchedVideoView {
    return {
      id,
      title: matched?.title ?? null,
      channel: matched ? channelOf(matched.ownerId) : null,
      thumbnailUrl: matched ? thumbnailUrl(matched, this.deps.cdn) : undefined,
      status: matched?.status ?? null,
      sameChannel: sameChannel ?? false,
      mirrored: video?.mirrored ?? false,
      videoCoverage: video?.coverage ?? null,
      audioCoverage: audio?.coverage ?? null,
      sourceRange:
        rangeOf(video?.runFromSeconds, video?.runToSeconds) ??
        rangeOf(audio?.runFromSeconds, audio?.runToSeconds),
      matchedRange: rangeOf(video?.runFromSeconds, video?.runToSeconds, video?.offsetSeconds),
    };
  }
}
