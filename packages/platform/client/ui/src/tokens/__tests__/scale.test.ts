import { ScaleSchema } from '@vp/design-tokens';
import { scale } from '../scale';

describe('@vp/ui: the scale', () => {
  it('parses: the space scale on the 4 px grid, z layers and breakpoints rising in order', () => {
    expect(ScaleSchema.safeParse(scale).error).toBeUndefined();
  });
});
