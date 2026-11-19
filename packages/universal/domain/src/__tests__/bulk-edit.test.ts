import { mergeTags } from '../bulk-edit';

describe('@vp/domain: mergeTags', () => {
  it.each([
    { name: 'adds a new tag', current: ['a'], add: ['b'], remove: [], expected: ['a', 'b'] },
    {
      name: 'ignores a repeat in another case',
      current: ['Cats'],
      add: ['cats'],
      remove: [],
      expected: ['Cats'],
    },
    {
      name: 'removes without case',
      current: ['Cats', 'dogs'],
      add: [],
      remove: ['CATS'],
      expected: ['dogs'],
    },
    { name: 'removes what it also adds', current: [], add: ['x'], remove: ['x'], expected: [] },
    { name: 'trims added tags', current: [], add: ['  new  '], remove: [], expected: ['new'] },
    {
      name: 'changes nothing without a patch',
      current: ['a'],
      add: undefined,
      remove: undefined,
      expected: ['a'],
    },
  ])('$name', ({ current, add, remove, expected }) => {
    expect(mergeTags(current, add, remove)).toEqual(expected);
  });
});
