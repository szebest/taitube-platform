import { databaseUnavailable } from '@kit/errors';
import { err } from '@kit/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ExperimentOverlay } from '../experiment-overlay';
import { TEST_ID, sessionShown, startTitleTest } from './running-test';

const OWNER = '00000000-0000-7000-8000-0000000000e9';
const TESTED = '00000000-0000-7000-8000-0000000000ea';
const PLAIN = '00000000-0000-7000-8000-0000000000eb';
const POSTER = 'http://cdn/poster.jpg';
const CUSTOM = 'http://cdn/custom.jpg';

const card = (id: string, title: string) => ({
  id,
  title,
  posterUrl: POSTER,
  thumbnailUrl: CUSTOM,
});

describe('apps/server/api/services: ExperimentOverlay', () => {
  let repositories: InMemoryRepositories;
  let overlay: ExperimentOverlay;
  const testedCard = card(TESTED, 'Control');
  const plainCard = card(PLAIN, 'Untested');
  const cards = [testedCard, plainCard];

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    overlay = new ExperimentOverlay(repositories.videoExperiments);
    await startTitleTest(repositories, {
      videoId: TESTED,
      ownerId: OWNER,
      control: 'Control',
      challenger: 'Challenger',
    });
  });

  it.each([
    { variant: 'a' as const, title: 'Control' },
    { variant: 'b' as const, title: 'Challenger' },
  ])(
    'shows a session given variant $variant its title and tags the card',
    async ({ variant, title }) => {
      const [tested, plain] = await overlay.apply(cards, sessionShown(TEST_ID, variant));

      expect(tested).toEqual({
        ...testedCard,
        title,
        experiment: { id: TEST_ID, variantId: variant },
      });
      expect(plain).toEqual(plainCard);
    }
  );

  it('gives one session the same variant on every read', async () => {
    const session = sessionShown(TEST_ID, 'b');

    const reads = await Promise.all([1, 2, 3].map(() => overlay.applyOne(testedCard, session)));

    expect(new Set(reads.map(({ title }) => title))).toEqual(new Set(['Challenger']));
  });

  it('changes and tags nothing without a session key, and looks nothing up', async () => {
    const runningFor = vi.spyOn(repositories.videoExperiments, 'runningFor');

    expect(await overlay.apply(cards, null)).toEqual(cards);
    expect(runningFor).not.toHaveBeenCalled();
  });

  it('looks up a page of cards in one read', async () => {
    const runningFor = vi.spyOn(repositories.videoExperiments, 'runningFor');

    await overlay.apply([...cards, card(TESTED, 'Control')], sessionShown(TEST_ID, 'a'));

    expect(runningFor.mock.calls).toEqual([[[TESTED, PLAIN]]]);
  });

  it('serves the control when the lookup fails', async () => {
    vi.spyOn(repositories.videoExperiments, 'runningFor').mockResolvedValueOnce(
      err(databaseUnavailable('runningFor'))
    );

    expect(await overlay.apply(cards, sessionShown(TEST_ID, 'b'))).toEqual(cards);
  });

  it('shows the poster for a variant that tests the poster', async () => {
    await repositories.videoExperiments.end(TESTED, TEST_ID, {
      status: 'stopped',
      winnerVariantId: null,
      at: new Date(),
    });
    await repositories.videoExperiments.create(
      {
        id: '00000000-0000-7000-8000-0000000000ec',
        videoId: TESTED,
        kind: 'thumbnail',
        variants: [
          { id: 'a', title: null, thumbnail: { source: 'poster' } },
          { id: 'b', title: null, thumbnail: { source: 'poster' } },
        ],
        status: 'running',
        startedAt: new Date(),
        endedAt: null,
        winnerVariantId: null,
      },
      OWNER,
      5
    );

    const shown = await overlay.applyOne(testedCard, 'session-000000000000');

    expect(shown).toMatchObject({ title: 'Control', thumbnailUrl: POSTER });
  });
});
