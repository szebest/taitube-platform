import type { FeedbackTarget } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import {
  CLIP,
  FOOD,
  GAMING,
  type HomeApp,
  MUSIC,
  NIGHT,
  OTHER,
  TRAM,
  VIEWER,
  buildHomeApp,
} from './home-app';

describe('apps/server/api/services: HomeService with feedback', () => {
  let app: HomeApp;

  beforeEach(async () => {
    app = await buildHomeApp();
  });

  const hide = (target: FeedbackTarget, userId: string = VIEWER.id) =>
    app.repositories.recommendationFeedback.put({
      ...target,
      id: uuidv7(),
      userId,
      createdAt: new Date(),
    });

  const shelvesOf = async () =>
    expectOk(await app.service.get(VIEWER)).shelves.map(({ kind, subject, items }) => [
      subject ? `${kind}:${subject.id}` : kind,
      items.map(({ id }) => id).sort(),
    ]);

  it.each([
    {
      scenario: 'a hidden video leaves every shelf and takes a shelf it emptied with it',
      target: (): FeedbackTarget => ({ kind: 'not_interested', videoId: FOOD }),
      expected: [
        ['continue', [NIGHT, TRAM].sort()],
        ['subscriptions', [CLIP, NIGHT].sort()],
        [`category:${MUSIC}`, [NIGHT, TRAM].sort()],
        [`category:${GAMING}`, [CLIP]],
        ['trending', [CLIP, NIGHT, TRAM].sort()],
      ],
    },
    {
      scenario: 'a hidden channel leaves every shelf but continue and subscriptions',
      target: (): FeedbackTarget => ({ kind: 'hide_channel', channelId: app.creatorChannelId }),
      expected: [
        ['continue', [NIGHT, TRAM].sort()],
        ['subscriptions', [CLIP, NIGHT].sort()],
        [`because-watched:${TRAM}`, [FOOD]],
        [`category:${MUSIC}`, [FOOD, TRAM].sort()],
        ['trending', [FOOD, TRAM].sort()],
      ],
    },
    {
      scenario: 'a hidden video the viewer is watching stays in continue',
      target: (): FeedbackTarget => ({ kind: 'not_interested', videoId: TRAM }),
      expected: [
        ['continue', [NIGHT, TRAM].sort()],
        ['subscriptions', [CLIP, NIGHT].sort()],
        [`because-watched:${TRAM}`, [FOOD]],
        [`category:${MUSIC}`, [FOOD, NIGHT].sort()],
        [`category:${GAMING}`, [CLIP]],
        ['trending', [CLIP, FOOD, NIGHT].sort()],
      ],
    },
  ])('$scenario', async ({ target, expected }) => {
    await hide(target());

    expect(await shelvesOf()).toEqual(expected);
  });

  it('filters nothing for a visitor and nothing of another viewer', async () => {
    await hide({ kind: 'not_interested', videoId: FOOD }, OTHER);

    const shelves = expectOk(await app.service.get(null)).shelves;

    expect(shelves.flatMap(({ items }) => items.map(({ id }) => id))).toContain(FOOD);
    expect((await shelvesOf()).map(([kind]) => kind)).toContain(`because-watched:${TRAM}`);
  });
});
