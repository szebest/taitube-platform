import { FALLBACK_ACTIVE_LOCALE } from '@vp/intl-react';
import { liveStream } from '@vp/web-testing';

import { headWords } from '../head-words';
import { liveHead } from '../live-head';

const SITE = 'https://taitube.test';
const WORDS = headWords(FALLBACK_ACTIVE_LOCALE);

describe('apps/client/web: liveHead', () => {
  it.each([
    { scenario: 'its description', description: 'Trams at dusk.', expected: 'Trams at dusk.' },
    {
      scenario: 'a line about the channel without one',
      description: '',
      expected: 'The Creator live on Taitube.',
    },
  ])('describes the broadcast by $scenario', ({ description, expected }) => {
    const { meta } = liveHead(liveStream({ description }), SITE, WORDS);

    expect(meta).toContainEqual({ name: 'description', content: expected });
  });

  it('links its canonical URL and publishes it as a live broadcast while live', () => {
    const stream = liveStream({ endedAt: null });

    const head = liveHead(stream, SITE, WORDS);

    expect(head.links[0]).toEqual({ rel: 'canonical', href: `${SITE}/live/${stream.id}` });
    expect(JSON.parse(head.scripts[0]?.children ?? '')).toMatchObject({
      '@type': 'VideoObject',
      publication: {
        '@type': 'BroadcastEvent',
        isLiveBroadcast: true,
        startDate: stream.startedAt,
      },
    });
  });
});
