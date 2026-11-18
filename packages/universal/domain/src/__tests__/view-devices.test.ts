import { VIEW_DEVICES, mergeDeviceCounts } from '../view-devices';

const VIDEO = '00000000-0000-7000-8000-00000000000a';

describe('domain: view devices', () => {
  it('names the three classes a client reports and the one it did not', () => {
    expect(VIEW_DEVICES).toEqual(['desktop', 'mobile', 'tablet', 'unknown']);
  });

  it('adds the counts of one video, day and device together and keeps the rest apart', () => {
    expect(
      mergeDeviceCounts([
        { videoId: VIDEO, viewDate: '2026-03-10', device: 'mobile', views: 2 },
        { videoId: VIDEO, viewDate: '2026-03-10', device: 'mobile', views: 3 },
        { videoId: VIDEO, viewDate: '2026-03-10', device: 'desktop', views: 1 },
        { videoId: VIDEO, viewDate: '2026-03-11', device: 'mobile', views: 4 },
      ])
    ).toEqual([
      { videoId: VIDEO, viewDate: '2026-03-10', device: 'mobile', views: 5 },
      { videoId: VIDEO, viewDate: '2026-03-10', device: 'desktop', views: 1 },
      { videoId: VIDEO, viewDate: '2026-03-11', device: 'mobile', views: 4 },
    ]);
  });
});
