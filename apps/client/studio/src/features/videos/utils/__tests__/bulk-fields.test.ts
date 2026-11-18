import { buildBulkPatch } from '../bulk-fields';

describe('apps/client/studio: buildBulkPatch', () => {
  it.each([
    { field: 'visibility', value: 'unlisted', patch: { visibility: 'unlisted' } },
    { field: 'categoryId', value: 'none', patch: { categoryId: null } },
    { field: 'categoryId', value: 'c1', patch: { categoryId: 'c1' } },
    { field: 'addTags', value: ' travel, food ,, ', patch: { addTags: ['travel', 'food'] } },
    { field: 'removeTags', value: 'old', patch: { removeTags: ['old'] } },
    { field: 'commentsEnabled', value: 'on', patch: { commentsEnabled: true } },
    { field: 'commentsEnabled', value: 'off', patch: { commentsEnabled: false } },
  ] as const)('turns $value of $field into $patch', ({ field, value, patch }) => {
    expect(buildBulkPatch(field, value)).toEqual(patch);
  });

  it.each([
    { field: 'visibility', value: 'secret' },
    { field: 'addTags', value: ' , ' },
    { field: 'removeTags', value: '' },
    { field: 'commentsEnabled', value: 'maybe' },
  ] as const)('answers nothing for $value of $field', ({ field, value }) => {
    expect(buildBulkPatch(field, value)).toBeNull();
  });
});
