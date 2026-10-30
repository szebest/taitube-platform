import { countsFromBuffer, retentionFromBuffer, viewBufferField } from '../view-buffer-fields';

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
