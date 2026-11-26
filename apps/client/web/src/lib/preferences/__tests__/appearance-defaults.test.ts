import { accountAppearance, DEFAULT_APPEARANCE } from '@kit/ui';
import { DEFAULT_PREFERENCES } from '@vp/domain/settings';

describe('apps/client/web: appearance defaults', () => {
  it('reads an empty appearance cookie as the account settings defaults', () => {
    expect(accountAppearance(DEFAULT_APPEARANCE)).toEqual(DEFAULT_PREFERENCES.appearance);
  });
});
