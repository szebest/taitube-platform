import { RefSchema } from '@vp/design-tokens';
import { ramps } from '../ref';

describe('@vp/ui: the ref ramps', () => {
  it('parse as kebab-case ramps of hex steps', () => {
    expect(RefSchema.safeParse(ramps).error).toBeUndefined();
  });
});
