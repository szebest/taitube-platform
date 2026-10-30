import { video } from '@vp/web-testing';

import { NO_CATEGORY, editOf, valuesOf } from '../edit-video-values';

const CATEGORY = '0190c3a0-5e1d-7000-8000-00000000c001';

describe('apps/client/studio: edit video values', () => {
  it.each([
    {
      stored: video({ title: null, description: null, categoryId: null }),
      values: { title: '', description: '', categoryId: NO_CATEGORY, tags: [] },
    },
    {
      stored: video({ title: 'A', description: 'B', categoryId: CATEGORY, tags: ['x'] }),
      values: { title: 'A', description: 'B', categoryId: CATEGORY, tags: ['x'] },
    },
  ])('fills the form from a video with title $stored.title', ({ stored, values }) => {
    expect(valuesOf(stored)).toMatchObject({ ...values, visibility: 'public', usePoster: false });
  });

  it.each([
    {
      change: { categoryId: NO_CATEGORY },
      expected: { categoryId: null },
    },
    {
      change: { categoryId: CATEGORY, usePoster: true },
      expected: { categoryId: CATEGORY, selectedThumbnail: { source: 'poster' } },
    },
  ])('turns the form into an edit against a version: $change', ({ change, expected }) => {
    const edit = editOf({ ...valuesOf(video()), ...change }, 7);

    expect(edit).toMatchObject({ ...expected, version: 7 });
    expect(edit).not.toHaveProperty('usePoster');
  });
});
