import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { CaptionService } from '../caption-service';
import {
  CAPTION_OWNER,
  CAPTION_STRANGER,
  CAPTIONED,
  PRIVATE_CAPTIONED,
  seedCaptionVideos,
  seedTrack,
  UNPROBED,
} from './caption-fixture';
import { TEST_CDN } from './service-deps';

const ORIGIN = { requestId: 'req-1' };

describe('CaptionService', () => {
  let repositories: InMemoryRepositories;
  let service: CaptionService;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    service = new CaptionService({
      videos: repositories.videos,
      captions: repositories.captions,
      outbox: repositories.outbox,
      cdn: TEST_CDN,
      settings: { enabled: true, modelVersion: 'small-q5_1' },
    });
    await seedCaptionVideos(repositories);
  });

  async function queuedRuns() {
    return expectOk(await repositories.outbox.claimBatch(10)).filter(
      (item) => item.kind === 'captions'
    );
  }

  async function seedEveryState(): Promise<void> {
    await seedTrack(repositories, { id: '00000000-0000-7000-8000-00000000cb01', kind: 'auto' });
    await seedTrack(repositories, {
      id: '00000000-0000-7000-8000-00000000cb02',
      kind: 'uploaded',
      language: 'de',
    });
    await seedTrack(repositories, {
      id: '00000000-0000-7000-8000-00000000cb03',
      kind: 'failed',
      videoId: PRIVATE_CAPTIONED,
    });
  }

  it.each([
    {
      who: 'a viewer',
      viewer: null,
      switched: null,
      seen: [
        ['en', 'auto'],
        ['de', 'uploaded'],
      ],
    },
    { who: 'a viewer', viewer: null, switched: false, seen: [['de', 'uploaded']] },
    {
      who: 'the owner',
      viewer: CAPTION_OWNER,
      switched: false,
      seen: [
        ['en', 'auto'],
        ['de', 'uploaded'],
      ],
    },
  ])(
    'shows $who with the switch at $switched the tracks $seen',
    async ({ viewer, switched, seen }) => {
      await seedEveryState();
      expectOk(await repositories.captions.setAutoCaptions(CAPTIONED, switched));

      const listed = expectOk(await service.list(viewer, CAPTIONED));

      expect(listed.tracks.map((track) => [track.language, track.kind])).toEqual(seen);
    }
  );

  it('shows the owner every state with its reason, version and the switch', async () => {
    await seedEveryState();

    const listed = expectOk(await service.list(CAPTION_OWNER, PRIVATE_CAPTIONED));

    expect(listed).toEqual({
      tracks: [expect.objectContaining({ status: 'failed', reason: 'WHISPER_TIMEOUT', url: null })],
      settings: { autoCaptions: null, channelDefault: false },
    });
  });

  it('hides a pending track and the settings from a viewer', async () => {
    await seedTrack(repositories, { id: '00000000-0000-7000-8000-00000000cb04', kind: 'pending' });

    expect(expectOk(await service.list(CAPTION_STRANGER, CAPTIONED))).toEqual({ tracks: [] });
  });

  it.each([
    {
      name: 'the generated track by default',
      query: {},
      texts: ['Welcome to the kitchen', 'Today we bake bread'],
    },
    { name: 'the cues matching q', query: { q: 'bread' }, texts: ['Today we bake bread'] },
    {
      name: 'the asked language',
      query: { lang: 'DE' },
      texts: ['Welcome to the kitchen', 'Today we bake bread'],
    },
  ])('reads $name from the transcript', async ({ query, texts }) => {
    await seedEveryState();

    const transcript = expectOk(await service.transcript(null, CAPTIONED, query));

    expect(transcript.cues.map((cue) => cue.text)).toEqual(texts);
  });

  it.each([
    { name: 'a language with no track', query: { lang: 'fr' }, code: ErrorCodes.CAPTION_NOT_FOUND },
    {
      name: 'a malformed language',
      query: { lang: 'not a tag' },
      code: ErrorCodes.VALIDATION_FAILED,
    },
  ])('refuses a transcript for $name', async ({ query, code }) => {
    await seedEveryState();

    expect(expectErr(await service.transcript(null, CAPTIONED, query)).code).toBe(code);
  });

  it('keeps a private video captions from a stranger, as a refusal the edge disguises', async () => {
    const refused = expectErr(await service.transcript(CAPTION_STRANGER, PRIVATE_CAPTIONED, {}));

    expect(refused).toMatchObject({ code: ErrorCodes.FORBIDDEN, readable: false });
  });

  it('starts one run when the switch turns on, however often it is set', async () => {
    expectOk(await service.setAutoCaptions(CAPTION_OWNER, CAPTIONED, true, ORIGIN));
    const listed = expectOk(await service.setAutoCaptions(CAPTION_OWNER, CAPTIONED, true, ORIGIN));

    expect(listed.tracks).toEqual([expect.objectContaining({ kind: 'auto', status: 'pending' })]);
    const runs = await queuedRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0]?.payload).toMatchObject({
      type: 'flow',
      flow: { data: { videoId: CAPTIONED, captionVersion: 1, requestId: 'req-1' } },
    });
  });

  it('keeps the generated track when the switch turns off', async () => {
    await seedTrack(repositories, { id: '00000000-0000-7000-8000-00000000cb05', kind: 'auto' });

    const listed = expectOk(await service.setAutoCaptions(CAPTION_OWNER, CAPTIONED, false, ORIGIN));

    expect(listed.settings?.autoCaptions).toBe(false);
    expect(listed.tracks).toHaveLength(1);
    expect(await queuedRuns()).toEqual([]);
  });

  it.each([
    { name: 'a video probe has not measured', videoId: UNPROBED, autoCaptions: true },
    { name: 'a video following a channel that is off', videoId: CAPTIONED, autoCaptions: null },
  ])('stores the switch and starts nothing for $name', async ({ videoId, autoCaptions }) => {
    const listed = expectOk(
      await service.setAutoCaptions(CAPTION_OWNER, videoId, autoCaptions, ORIGIN)
    );

    expect(listed.tracks).toEqual([]);
    expect(await queuedRuns()).toEqual([]);
  });

  it('retries a failed generated track when the switch turns on', async () => {
    await seedTrack(repositories, { id: '00000000-0000-7000-8000-00000000cb06', kind: 'failed' });

    expectOk(await service.setAutoCaptions(CAPTION_OWNER, CAPTIONED, true, ORIGIN));

    expect(await queuedRuns()).toHaveLength(1);
  });

  it('refuses a stranger the switch with a 403 that hides nothing', async () => {
    const refused = expectErr(
      await service.setAutoCaptions(CAPTION_STRANGER, CAPTIONED, true, ORIGIN)
    );

    expect(refused).toMatchObject({ code: ErrorCodes.FORBIDDEN, readable: true });
  });

  it.each([
    { overwrite: false, code: ErrorCodes.CAPTION_OVERWRITE_UNCONFIRMED, runs: 0 },
    { overwrite: true, code: undefined, runs: 1 },
  ])(
    'regenerates an edited track only when confirmed: overwrite $overwrite',
    async ({ overwrite, code, runs }) => {
      await seedTrack(repositories, { id: '00000000-0000-7000-8000-00000000cb07', kind: 'edited' });

      const generated = await service.generate(CAPTION_OWNER, CAPTIONED, { overwrite }, ORIGIN);

      expect(generated.ok ? undefined : generated.error.code).toBe(code);
      expect(await queuedRuns()).toHaveLength(runs);
    }
  );

  it('runs a regenerate in the hinted language', async () => {
    const track = expectOk(
      await service.generate(CAPTION_OWNER, CAPTIONED, { language: 'pl' }, ORIGIN)
    );

    expect(track).toMatchObject({ kind: 'auto', status: 'pending', language: 'pl' });
    expect((await queuedRuns())[0]?.payload).toMatchObject({ flow: { data: { language: 'pl' } } });
  });

  it('refuses a hint another track already holds', async () => {
    await seedTrack(repositories, {
      id: '00000000-0000-7000-8000-00000000cb08',
      kind: 'uploaded',
      language: 'de',
    });

    const refused = expectErr(
      await service.generate(CAPTION_OWNER, CAPTIONED, { language: 'de' }, ORIGIN)
    );

    expect(refused).toMatchObject({ code: ErrorCodes.VALIDATION_FAILED, language: 'de' });
  });

  it.each([
    { name: 'the owner with a channel', actor: CAPTION_OWNER, outcome: { enabled: true } },
    {
      name: 'a caller with no channel',
      actor: CAPTION_STRANGER,
      outcome: ErrorCodes.CHANNEL_NOT_FOUND,
    },
  ])('sets the channel default for $name', async ({ actor, outcome }) => {
    const set = await service.setChannelDefault(actor, true);

    expect(set.ok ? set.value : set.error.code).toEqual(outcome);
  });
});
