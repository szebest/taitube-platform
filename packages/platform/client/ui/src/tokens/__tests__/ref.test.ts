import { RefSchema } from '@kit/design-tokens';
import { ramps } from '../ref';

describe('@kit/ui: the ref ramps', () => {
  it('parse as kebab-case ramps of hex steps', () => {
    expect(RefSchema.safeParse(ramps).error).toBeUndefined();
  });
});
