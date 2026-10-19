import type { Theme } from '../../schema/theme';
import { themeCss } from '../theme-css';
import { fixtureTheme, lines } from './fixture';

const cssFor = (oled: Theme['color']['oled'] = fixtureTheme.color.oled) =>
  themeCss({ ...fixtureTheme, color: { ...fixtureTheme.color, oled } });

describe('themeCss', () => {
  it('writes the dark roles for dark and OLED, the light roles, then the OLED overrides', () => {
    expect(cssFor()).toBe(
      lines(
        '[data-theme="dusk"] {',
        '  --dataviz-sequential-1: #F0E0C0;',
        '  --dataviz-sequential-2: #E0C080;',
        '  --dataviz-sequential-3: #C08040;',
        '  --dataviz-sequential-4: #806030;',
        '  --dataviz-sequential-5: #403020;',
        '  --dataviz-diverging-1: #A05030;',
        '  --dataviz-diverging-2: #D08060;',
        '  --dataviz-diverging-3: #C0C0C0;',
        '  --dataviz-diverging-4: #60B0A0;',
        '  --dataviz-diverging-5: #207070;',
        '}',
        '',
        '[data-theme="dusk"]:is([data-mode="dark"], [data-mode="oled"]) {',
        '  --bg: #101010;',
        '  --surface: #181818;',
        '  --raised: #202020;',
        '  --border: #303030;',
        '  --border-strong: #707070;',
        '  --fg: #F0F0F0;',
        '  --fg-muted: #B0B0B0;',
        '  --fg-subtle: #808080;',
        '  --tint: #FFFFFF12;',
        '  --tint-strong: #FFFFFF1F;',
        '  --accent: #C08040;',
        '  --accent-hover: #D09050;',
        '  --on-accent: #101010;',
        '  --accent-ink: #D09050;',
        '  --accent-soft: #C0804029;',
        '  --focus-ring: #D09050;',
        '  --live: #D02030;',
        '  --on-live: #FFFFFF;',
        '  --danger: #C03030;',
        '  --danger-ink: #F09090;',
        '  --success-ink: #90C090;',
        '  --warning-ink: #F0A070;',
        '  --info-ink: #90B0E0;',
        '  --scrim: #000000B8;',
        '  --media: #000000;',
        '  --dataviz-categorical-1: #C08040;',
        '  --dataviz-categorical-2: #80B090;',
        '  --dataviz-categorical-3: #80A0D0;',
        '  --dataviz-categorical-4: #D08060;',
        '  --dataviz-categorical-5: #B090D0;',
        '  --dataviz-categorical-6: #60B0A0;',
        '}',
        '',
        '[data-theme="dusk"]:is([data-mode="light"]) {',
        '  --bg: #F8F8F8;',
        '  --surface: #FFFFFF;',
        '  --raised: #202020;',
        '  --border: #303030;',
        '  --border-strong: #707070;',
        '  --fg: #181818;',
        '  --fg-muted: #B0B0B0;',
        '  --fg-subtle: #808080;',
        '  --tint: #FFFFFF12;',
        '  --tint-strong: #FFFFFF1F;',
        '  --accent: #C08040;',
        '  --accent-hover: #D09050;',
        '  --on-accent: #101010;',
        '  --accent-ink: #D09050;',
        '  --accent-soft: #C0804029;',
        '  --focus-ring: #D09050;',
        '  --live: #D02030;',
        '  --on-live: #FFFFFF;',
        '  --danger: #C03030;',
        '  --danger-ink: #F09090;',
        '  --success-ink: #90C090;',
        '  --warning-ink: #F0A070;',
        '  --info-ink: #90B0E0;',
        '  --scrim: #000000B8;',
        '  --media: #000000;',
        '  --dataviz-categorical-1: #806030;',
        '  --dataviz-categorical-2: #407050;',
        '  --dataviz-categorical-3: #406090;',
        '  --dataviz-categorical-4: #A05030;',
        '  --dataviz-categorical-5: #705090;',
        '  --dataviz-categorical-6: #207070;',
        '}',
        '',
        '[data-theme="dusk"][data-mode="oled"] {',
        '  --bg: #000000;',
        '  --surface: #080808;',
        '}'
      )
    );
  });

  it('writes no OLED rule for a theme whose OLED mode is its dark mode', () => {
    expect(cssFor({})).not.toContain('[data-theme="dusk"][data-mode="oled"]');
  });
});
