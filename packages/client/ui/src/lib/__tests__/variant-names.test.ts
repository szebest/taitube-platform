import { variantNames } from '../variant-names';

describe('@vp/ui: variantNames', () => {
  it('lists the names a variant offers, in the order it declares them', () => {
    expect(variantNames({ sm: 'h-8', md: 'h-9', lg: 'h-11' })).toEqual(['sm', 'md', 'lg']);
  });
});
