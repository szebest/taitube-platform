import type { CaptionRecord, CaptionRepository } from '@vp/core/repositories';
import type { TranscriptCue } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { OWNER_ID, publicVideo, seedOwners, VIDEO_IDS } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

export const GENERATED_ID = '00000000-0000-7000-8000-0000000004a1';
export const UPLOADED_ID = '00000000-0000-7000-8000-0000000004a2';
export const CHANNEL_ID = '00000000-0000-7000-8000-0000000004c1';
export const ABSENT_ID = '00000000-0000-7000-8000-0000000004ff';

export const CUES: TranscriptCue[] = [
  { index: 0, startMs: 0, endMs: 1500, text: 'Welcome to the channel' },
  { index: 1, startMs: 1500, endMs: 3000, text: 'Today we bake bread' },
  { index: 2, startMs: 3000, endMs: 4500, text: 'Bread needs flour and water' },
];

export interface CaptionContractContext {
  readonly subject: RepositoriesSubject;
  readonly captions: CaptionRepository;
}

/** Registers the hooks of a contract file and returns the context they fill. */
export function captionContractContext(
  makeSubject: MakeRepositoriesSubject
): CaptionContractContext {
  let subject: RepositoriesSubject;
  const ctx: CaptionContractContext = {
    get subject() {
      return subject;
    },
    get captions() {
      return subject.repositories.captions;
    },
  };

  beforeAll(async () => {
    subject = await makeSubject();
  });

  afterAll(async () => {
    await subject.close();
  });

  beforeEach(async () => {
    await subject.reset();
    await seedOwners(subject.repositories);
    await subject.seedVideo(publicVideo({ id: VIDEO_IDS.a }));
  });

  return ctx;
}

export async function generated(
  ctx: CaptionContractContext,
  status: 'pending' | 'disabled' = 'pending'
): Promise<CaptionRecord> {
  return expectOk(
    await ctx.captions.createGenerated({
      id: GENERATED_ID,
      videoId: VIDEO_IDS.a,
      language: null,
      modelVersion: 'whisper-1',
      status,
      reason: status === 'disabled' ? 'NO_AUDIO' : null,
    })
  );
}

export async function ready(ctx: CaptionContractContext): Promise<CaptionRecord> {
  const pending = await generated(ctx);
  const done = expectOk(
    await ctx.captions.complete({
      id: pending.id,
      expectedVersion: pending.version,
      language: 'en',
      detectedLanguage: 'en',
      cues: CUES,
    })
  );
  if (done.type !== 'committed') throw new Error(`complete answered ${done.type}`);
  return done.track;
}

export async function upload(ctx: CaptionContractContext, language = 'pl', id = UPLOADED_ID) {
  return expectOk(await ctx.captions.upload({ id, videoId: VIDEO_IDS.a, language, cues: CUES }));
}

export function trackOf(commit: { type: string; track?: CaptionRecord }): CaptionRecord {
  if (commit.type !== 'committed' || !commit.track)
    throw new Error(`commit answered ${commit.type}`);
  return commit.track;
}

export async function userEventsOf(ctx: CaptionContractContext, userId = OWNER_ID) {
  return expectOk(await ctx.subject.repositories.userEvents.listFrom(userId, 0, 50)).map(
    ({ type, payload }) => ({ type, payload })
  );
}

export async function videoEventTypes(ctx: CaptionContractContext): Promise<string[]> {
  return expectOk(await ctx.subject.repositories.events.findByVideoId(VIDEO_IDS.a)).map(
    (event) => event.type
  );
}
