import { findDefaultRendition } from '../playback-defaults';

const P480 = { id: '0', height: 480 };
const P720 = { id: '1', height: 720 };
const P1080 = { id: '2', height: 1080 };
const LADDER = [P480, P720, P1080];

describe('apps/client/web: findDefaultRendition', () => {
  it.each([
    { scenario: 'a rung the master lists', renditions: LADDER, quality: '720p', id: '1' },
    {
      scenario: 'a rung above the master',
      renditions: [P480, P720],
      quality: '1080p',
      id: '1',
    },
    {
      scenario: 'a rung between two',
      renditions: [P480, P1080],
      quality: '720p',
      id: '0',
    },
    {
      scenario: 'a rung below every rendition',
      renditions: [P720, P1080],
      quality: '480p',
      id: undefined,
    },
    { scenario: 'auto', renditions: LADDER, quality: 'auto', id: undefined },
    {
      scenario: 'renditions with no height',
      renditions: [{ id: '0' }],
      quality: '720p',
      id: undefined,
    },
  ])('picks $id for $scenario', ({ renditions, quality, id }) => {
    expect(findDefaultRendition(renditions, quality)).toBe(id);
  });
});
