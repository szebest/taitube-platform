import { expectErr, expectOk } from '@kit/testing/result';
import { validateBulkEdit } from '../validate-bulk-edit.rule';

describe('@vp/domain-rules: validateBulkEdit', () => {
  it.each([
    {
      name: 'a visibility change',
      input: { ids: ['a'], patch: { visibility: 'private' as const } },
      expected: { ids: ['a'], patch: { visibility: 'private' } },
    },
    {
      name: 'repeated ids',
      input: { ids: ['a', 'a', 'b'], patch: { commentsEnabled: false } },
      expected: { ids: ['a', 'b'], patch: { commentsEnabled: false } },
    },
    {
      name: 'a category cleared',
      input: { ids: ['a'], patch: { categoryId: null } },
      expected: { ids: ['a'], patch: { categoryId: null } },
    },
    {
      name: 'padded tags',
      input: { ids: ['a'], patch: { addTags: [' x ', 'X'], removeTags: ['y '] } },
      expected: { ids: ['a'], patch: { addTags: ['x'], removeTags: ['y'] } },
    },
  ])('accepts $name', ({ input, expected }) => {
    expect(expectOk(validateBulkEdit(input))).toEqual(expected);
  });

  it.each([
    { name: 'no ids', input: { ids: [], patch: { commentsEnabled: true } }, field: 'ids' },
    {
      name: 'over 100 ids',
      input: {
        ids: Array.from({ length: 101 }, (_, i) => `v${i}`),
        patch: { commentsEnabled: true },
      },
      field: 'ids',
    },
    { name: 'an empty patch', input: { ids: ['a'], patch: {} }, field: 'patch' },
    {
      name: 'a patch of undefined values',
      input: { ids: ['a'], patch: { visibility: undefined } },
      field: 'patch',
    },
    {
      name: 'a tag over thirty characters',
      input: { ids: ['a'], patch: { addTags: ['x'.repeat(31)] } },
      field: 'patch',
    },
  ])('rejects $name', ({ input, field }) => {
    expect(expectErr(validateBulkEdit(input))).toMatchObject({ field, maxIds: 100 });
  });
});
