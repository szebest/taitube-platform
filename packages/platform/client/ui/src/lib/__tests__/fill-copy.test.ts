import { fillCopy } from '../fill-copy';

describe('@vp/ui: fill-copy', () => {
  it.each([
    { template: 'Reorder {name}', expected: 'Reorder Lisbon at night' },
    { template: 'Moved to position {position}', expected: 'Moved to position 3' },
    { template: 'Cancelled', expected: 'Cancelled' },
    { template: 'Unknown {other}', expected: 'Unknown {other}' },
  ])('fills $template as $expected', ({ template, expected }) => {
    expect(fillCopy(template, { name: 'Lisbon at night', position: 3 })).toBe(expected);
  });
});
