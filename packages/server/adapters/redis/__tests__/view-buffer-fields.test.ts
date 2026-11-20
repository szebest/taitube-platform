import {
  countsFromBuffer,
  deviceViewField,
  devicesFromBuffer,
  experimentField,
  experimentsFromBuffer,
  hourlyFromBuffer,
  hourlyViewField,
  retentionFromBuffer,
  shareLinkField,
  shareLinksFromBuffer,
  viewBufferField,
} from '../view-buffer-fields';

const VIDEO = '00000000-0000-7000-8000-00000000000a';
const OTHER = '00000000-0000-7000-8000-00000000000b';

describe('view buffer fields', () => {
  it('names a field by video, day and measure', () => {
    expect(viewBufferField(VIDEO, '2026-03-10', 'views')).toBe(`${VIDEO}|2026-03-10|views`);
  });

  it('folds the views and watch fields of each video and day into one count', () => {
    const counts = countsFromBuffer({
      [viewBufferField(VIDEO, '2026-03-10', 'views')]: '3',
      [viewBufferField(VIDEO, '2026-03-10', 'watch')]: '95',
      [viewBufferField(VIDEO, '2026-03-11', 'views')]: '1',
      [viewBufferField(VIDEO, '2026-03-11', 'watch')]: '7',
      [viewBufferField(OTHER, '2026-03-10', 'views')]: '2',
      [viewBufferField(OTHER, '2026-03-10', 'watch')]: '20',
    });

    expect(counts).toEqual([
      { videoId: VIDEO, viewDate: '2026-03-10', views: 3, watchSeconds: 95 },
      { videoId: VIDEO, viewDate: '2026-03-11', views: 1, watchSeconds: 7 },
      { videoId: OTHER, viewDate: '2026-03-10', views: 2, watchSeconds: 20 },
    ]);
  });

  it.each([
    ['a field of another shape', { stray: '4' }],
    ['an unknown measure', { [`${VIDEO}|2026-03-10|likes`]: '4' }],
    ['a field with extra parts', { [`${VIDEO}|2026-03-10|views|x`]: '4' }],
    ['a value that is no number', { [viewBufferField(VIDEO, '2026-03-10', 'views')]: 'many' }],
  ])('skips %s', (_name, hash) => {
    expect(countsFromBuffer(hash)).toEqual([]);
  });

  it('keeps watch time without a view', () => {
    expect(countsFromBuffer({ [viewBufferField(VIDEO, '2026-03-10', 'watch')]: '9' })).toEqual([
      { videoId: VIDEO, viewDate: '2026-03-10', views: 0, watchSeconds: 9 },
    ]);
  });
});

describe('device view buffer fields', () => {
  it('names a field by video, day and device, beside the views and watch fields of the same hash', () => {
    expect(deviceViewField(VIDEO, '2026-03-10', 'mobile')).toBe(
      `${VIDEO}|2026-03-10|device:mobile`
    );
  });

  it('reads the device fields of a views hash and leaves the other kinds to countsFromBuffer', () => {
    const hash = {
      [viewBufferField(VIDEO, '2026-03-10', 'views')]: '5',
      [viewBufferField(VIDEO, '2026-03-10', 'watch')]: '40',
      [deviceViewField(VIDEO, '2026-03-10', 'mobile')]: '3',
      [deviceViewField(VIDEO, '2026-03-10', 'desktop')]: '2',
      [deviceViewField(OTHER, '2026-03-11', 'unknown')]: '1',
    };

    expect(devicesFromBuffer(hash)).toEqual([
      { videoId: VIDEO, viewDate: '2026-03-10', device: 'mobile', views: 3 },
      { videoId: VIDEO, viewDate: '2026-03-10', device: 'desktop', views: 2 },
      { videoId: OTHER, viewDate: '2026-03-11', device: 'unknown', views: 1 },
    ]);
    expect(countsFromBuffer(hash)).toEqual([
      { videoId: VIDEO, viewDate: '2026-03-10', views: 5, watchSeconds: 40 },
    ]);
  });

  it.each([
    ['a field of another shape', { stray: '4' }],
    ['a device nobody reports', { [`${VIDEO}|2026-03-10|device:watch`]: '4' }],
    ['a field with extra parts', { [`${VIDEO}|2026-03-10|device:mobile|x`]: '4' }],
    ['a count that is not a number', { [deviceViewField(VIDEO, '2026-03-10', 'mobile')]: 'many' }],
    ['a count of zero', { [deviceViewField(VIDEO, '2026-03-10', 'mobile')]: '0' }],
  ])('skips %s', (_name, hash) => {
    expect(devicesFromBuffer(hash)).toEqual([]);
  });
});

describe('retention buffer fields', () => {
  it('reads a field as a video and a 5 percent step', () => {
    expect(retentionFromBuffer({ [`${VIDEO}|0`]: '4', [`${VIDEO}|50`]: '2' })).toEqual([
      { videoId: VIDEO, percent: 0, viewers: 4 },
      { videoId: VIDEO, percent: 50, viewers: 2 },
    ]);
  });

  it.each([
    ['a field of another shape', { stray: '4' }],
    ['a step that is not a number', { [`${VIDEO}|half`]: '4' }],
    ['a count that is not a number', { [`${VIDEO}|5`]: 'lots' }],
    ['a count of zero', { [`${VIDEO}|5`]: '0' }],
  ])('skips %s', (_name, hash) => {
    expect(retentionFromBuffer(hash)).toEqual([]);
  });
});

describe('hourly view buffer fields', () => {
  const HOUR = '2026-03-10T13:00:00.000Z';

  it('reads a field as a video and the hour its views were counted in', () => {
    expect(
      hourlyFromBuffer({ [hourlyViewField(VIDEO, HOUR)]: '3', [hourlyViewField(OTHER, HOUR)]: '1' })
    ).toEqual([
      { videoId: VIDEO, viewHour: HOUR, views: 3 },
      { videoId: OTHER, viewHour: HOUR, views: 1 },
    ]);
  });

  it.each([
    ['a field of another shape', { stray: '4' }],
    ['a field with extra parts', { [`${VIDEO}|${HOUR}|views`]: '4' }],
    ['a count that is not a number', { [hourlyViewField(VIDEO, HOUR)]: 'lots' }],
    ['a count of zero', { [hourlyViewField(VIDEO, HOUR)]: '0' }],
  ])('skips %s', (_name, hash) => {
    expect(hourlyFromBuffer(hash)).toEqual([]);
  });
});

describe('share link and test buffer fields', () => {
  const LINK = '00000000-0000-7000-8000-0000000000e1';
  const TEST = '00000000-0000-7000-8000-0000000000e2';
  const DAY = '2026-03-10';

  it('names a field as a views or watch field with the link or the variant on the end', () => {
    expect(shareLinkField(VIDEO, DAY, 'opens', LINK)).toBe(`${VIDEO}|${DAY}|opens|link:${LINK}`);
    expect(experimentField(VIDEO, DAY, 'starts', TEST, 'b')).toBe(
      `${VIDEO}|${DAY}|starts|exp:${TEST}:b`
    );
  });

  it('folds the link fields of a views hash into one count per link and day', () => {
    expect(
      shareLinksFromBuffer({
        [shareLinkField(VIDEO, DAY, 'opens', LINK)]: '4',
        [shareLinkField(VIDEO, DAY, 'views', LINK)]: '3',
        [shareLinkField(VIDEO, DAY, 'watch', LINK)]: '90',
        [shareLinkField(OTHER, DAY, 'opens', LINK)]: '1',
        [shareLinkField(VIDEO, '2026-03-11', 'views', LINK)]: '2',
      })
    ).toEqual([
      { linkId: LINK, viewDate: DAY, opens: 5, views: 3, watchSeconds: 90 },
      { linkId: LINK, viewDate: '2026-03-11', opens: 0, views: 2, watchSeconds: 0 },
    ]);
  });

  it('folds the variant fields of a views hash into one count per test, variant and day', () => {
    expect(
      experimentsFromBuffer({
        [experimentField(VIDEO, DAY, 'impressions', TEST, 'a')]: '10',
        [experimentField(VIDEO, DAY, 'starts', TEST, 'a')]: '2',
        [experimentField(VIDEO, DAY, 'watch', TEST, 'a')]: '40',
        [experimentField(VIDEO, DAY, 'impressions', TEST, 'b')]: '8',
      })
    ).toEqual([
      {
        experimentId: TEST,
        variantId: 'a',
        viewDate: DAY,
        impressions: 10,
        starts: 2,
        watchSeconds: 40,
      },
      {
        experimentId: TEST,
        variantId: 'b',
        viewDate: DAY,
        impressions: 8,
        starts: 0,
        watchSeconds: 0,
      },
    ]);
  });

  it('leaves the fields of every other kind to their own readers', () => {
    const hash = {
      [viewBufferField(VIDEO, DAY, 'views')]: '5',
      [viewBufferField(VIDEO, DAY, 'watch')]: '40',
      [deviceViewField(VIDEO, DAY, 'mobile')]: '3',
      [shareLinkField(VIDEO, DAY, 'views', LINK)]: '2',
      [shareLinkField(VIDEO, DAY, 'watch', LINK)]: '9',
      [experimentField(VIDEO, DAY, 'watch', TEST, 'b')]: '9',
    };

    expect(countsFromBuffer(hash)).toEqual([
      { videoId: VIDEO, viewDate: DAY, views: 5, watchSeconds: 40 },
    ]);
    expect(devicesFromBuffer(hash)).toEqual([
      { videoId: VIDEO, viewDate: DAY, device: 'mobile', views: 3 },
    ]);
    expect(shareLinksFromBuffer(hash)).toHaveLength(1);
    expect(experimentsFromBuffer(hash)).toHaveLength(1);
  });

  it.each([
    ['a field of another shape', { stray: '4' }],
    [
      'a field a writer from before the links wrote',
      { [viewBufferField(VIDEO, DAY, 'views')]: '4' },
    ],
    ['a measure nobody counts', { [`${VIDEO}|${DAY}|likes|link:${LINK}`]: '4' }],
    ['a field with extra parts', { [`${VIDEO}|${DAY}|opens|link:${LINK}|x`]: '4' }],
    ['a count that is not a number', { [shareLinkField(VIDEO, DAY, 'opens', LINK)]: 'many' }],
    ['a count of zero', { [shareLinkField(VIDEO, DAY, 'opens', LINK)]: '0' }],
  ])('reads %s as no link count', (_name, hash) => {
    expect(shareLinksFromBuffer(hash)).toEqual([]);
  });

  it.each([
    ['a variant nobody offers', { [`${VIDEO}|${DAY}|starts|exp:${TEST}:z`]: '4' }],
    ['a field with no variant', { [`${VIDEO}|${DAY}|starts|exp:${TEST}`]: '4' }],
    ['a measure nobody counts', { [`${VIDEO}|${DAY}|opens|exp:${TEST}:a`]: '4' }],
    ['a field with extra parts', { [`${VIDEO}|${DAY}|starts|exp:${TEST}:a:x`]: '4' }],
    [
      'a count that is not a number',
      { [experimentField(VIDEO, DAY, 'starts', TEST, 'a')]: 'many' },
    ],
  ])('reads %s as no test count', (_name, hash) => {
    expect(experimentsFromBuffer(hash)).toEqual([]);
  });
});
