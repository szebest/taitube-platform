import { variantNames } from '../variant-names';

describe('apps/client/web: variantNames', () => {
  it('lists the names a variant offers, in the order it declares them', () => {
    expect(variantNames({ sm: 'tw:h-8', md: 'tw:h-9', lg: 'tw:h-11' })).toEqual(['sm', 'md', 'lg']);
  });
});
