// @vitest-environment jsdom
import { DEFAULT_APPEARANCE, saveAppearancePreference } from '@kit/ui/appearance/preference';
import { SHOP_APPEARANCE } from '../appearance';

describe('quill shop appearance', () => {
  it('keeps the preference under its own cookie', () => {
    saveAppearancePreference({ ...DEFAULT_APPEARANCE, mode: 'dark' }, SHOP_APPEARANCE);

    const stored = document.cookie.split('; ').find((cookie) => cookie.startsWith('quill.look='));
    expect(JSON.parse(decodeURIComponent(stored?.slice('quill.look='.length) ?? '{}'))).toMatchObject({
      mode: 'dark',
    });
  });
});
