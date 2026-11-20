import { playbackAttribution } from '../playback-attribution';

const LINK_ID = '0190c3a0-5e1d-7000-8000-0000000000e1';
const EXPERIMENT_ID = '0190c3a0-5e1d-7000-8000-0000000000e2';

describe('apps/client/web: playbackAttribution', () => {
  it.each([
    {
      read: 'a share link and a test variant',
      video: { shareLinkId: LINK_ID, experiment: { id: EXPERIMENT_ID, variantId: 'b' as const } },
      attribution: {
        shareLinkId: LINK_ID,
        experiment: { experimentId: EXPERIMENT_ID, variantId: 'b' },
      },
    },
    {
      read: 'neither',
      video: {},
      attribution: { shareLinkId: undefined, experiment: undefined },
    },
  ])('tells the beacon what the read answered: $read', ({ video, attribution }) => {
    expect(playbackAttribution(video)).toEqual(attribution);
  });
});
