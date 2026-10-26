import { ICONS } from '../../icons/inventory';
import { TONE_ICONS } from '../tone-icons';

describe('@vp/ui: tone-icons', () => {
  it.each(Object.entries(TONE_ICONS))(
    'draws the %s tone with the %s glyph of the inventory',
    (_tone, glyph) => {
      expect(ICONS).toHaveProperty(glyph);
    }
  );

  it('draws a failure and a warning with the same alert glyph', () => {
    expect(TONE_ICONS.danger).toBe(TONE_ICONS.warning);
  });
});
