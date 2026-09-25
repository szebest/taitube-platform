import { countsFromBuffer, viewBufferField } from '../view-buffer-fields';

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
    ['watch time without a view', { [viewBufferField(VIDEO, '2026-03-10', 'watch')]: '9' }],
  ])('skips %s', (_name, hash) => {
    expect(countsFromBuffer(hash)).toEqual([]);
  });
});
