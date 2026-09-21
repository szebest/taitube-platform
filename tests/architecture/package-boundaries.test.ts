import { checkBoundaries } from '../../scripts/check-boundaries';

describe('architecture: package boundaries', () => {
  it('every package declares a tier and a layer that its dependencies respect', () => {
    expect(checkBoundaries()).toEqual([]);
  });
});
