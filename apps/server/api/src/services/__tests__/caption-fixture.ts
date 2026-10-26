import type { CaptionRecord, NewVideoInput, Repositories } from '@vp/core/repositories';
import type { CaptionKind, TranscriptCue } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { expectOk } from '@vp/testing/result';

export const CAPTION_OWNER: UserContext = {
  id: '00000000-0000-7000-8000-00000000ca01',
  role: 'USER',
};
export const CAPTION_STRANGER: UserContext = {
  id: '00000000-0000-7000-8000-00000000ca02',
  role: 'USER',
};
export const CAPTIONED = '00000000-0000-7000-8000-00000000ca10';
export const PRIVATE_CAPTIONED = '00000000-0000-7000-8000-00000000ca11';
export const UNPROBED = '00000000-0000-7000-8000-00000000ca12';

const CUES: TranscriptCue[] = [
  { index: 0, startMs: 0, endMs: 1_500, text: 'Welcome to the kitchen' },
  { index: 1, startMs: 1_500, endMs: 3_000, text: 'Today we bake bread' },
];

export const VTT =
  'WEBVTT\n\n00:00.000 --> 00:01.500\nHello there\n\n00:01.500 --> 00:03.000\nGeneral\n';

/** The owner's channel, a public and a private video probe has measured, and one it has not. */
export async function seedCaptionVideos(repositories: Repositories): Promise<void> {
  expectOk(
    await repositories.channels.create({
      userId: CAPTION_OWNER.id,
      handle: 'captioner',
      displayName: 'Captioner',
    })
  );
  const videos: Omit<NewVideoInput, 'ownerId'>[] = [
    { id: CAPTIONED, sourceKey: 'raw/bread.mp4', durationMs: 60_000 },
    {
      id: PRIVATE_CAPTIONED,
      sourceKey: 'raw/closed.mp4',
      durationMs: 60_000,
      visibility: 'private',
    },
    { id: UNPROBED, sourceKey: 'raw/fresh.mp4', status: 'PROBING' },
  ];
  for (const video of videos) {
    const owned = {
      ownerId: CAPTION_OWNER.id,
      status: 'READY',
      visibility: 'public',
      ...video,
    } as const;
    expectOk(await repositories.videos.create(owned));
  }
}

interface SeededTrack {
  id: string;
  kind: CaptionKind | 'failed' | 'pending';
  language?: string;
  videoId?: string;
}

/** A track in the state a spec needs, written through the repository as the worker would. */
export async function seedTrack(
  repositories: Repositories,
  { id, kind, language = 'en', videoId = CAPTIONED }: SeededTrack
): Promise<CaptionRecord> {
  const { captions } = repositories;
  if (kind === 'uploaded') {
    return committedTrack(await captions.upload({ id, videoId, language, cues: CUES }));
  }
  const pending = expectOk(
    await captions.createGenerated({
      id,
      videoId,
      language: null,
      modelVersion: 'small-q5_1',
      status: 'pending',
      reason: null,
    })
  );
  if (kind === 'pending') return pending;
  if (kind === 'failed') {
    const failed = { id, expectedVersion: 1, status: 'failed', reason: 'WHISPER_TIMEOUT' } as const;
    return committedTrack(await captions.fail(failed));
  }
  const ready = committedTrack(
    await captions.complete({
      id,
      expectedVersion: 1,
      language,
      detectedLanguage: language,
      cues: CUES,
    })
  );
  if (kind === 'auto') return ready;
  const edit = { id, expectedVersion: ready.version, cues: [{ index: 0, text: 'Hi' }] };
  return committedTrack(await captions.editCues(edit));
}

function committedTrack(
  result: Awaited<ReturnType<Repositories['captions']['upload']>>
): CaptionRecord {
  const commit = expectOk(result);
  if (commit.type !== 'committed') throw new Error(`seeding a track found it ${commit.type}`);
  return commit.track;
}
