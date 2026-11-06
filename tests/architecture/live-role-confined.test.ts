import { productionSources, read } from './repo-files';

/** Every surface the live feature draws: the pages, their wrappers, the kit under them and the player's badge. */
const LIVE_SURFACES = [
  /^apps\/client\/web\/src\/features\/live\//,
  /^apps\/client\/web\/src\/components\/live\//,
  /^apps\/client\/web\/src\/routes\/live\./,
  /^apps\/client\/web\/src\/features\/browse\/components\/live-now-shelf\.tsx$/,
  /^apps\/client\/web\/src\/features\/player\/components\/control-bar\.tsx$/,
  /^apps\/client\/studio\/src\/features\/live\//,
  /^apps\/client\/studio\/src\/components\/live\//,
  /^apps\/client\/studio\/src\/routes\/(?:_authed\/)?live\./,
];

/** The `live` colour role as a utility or a variable; its ink, `on-live`, is not the role. */
const LIVE_ROLE =
  /\b(?:bg|text|border|ring|outline|fill|stroke|from|via|to|shadow|divide|decoration|accent|caret)-live\b|var\(--live\)/;

/** A red written as a value instead of reached through a role. */
const RED_VALUE = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab)\(|\b(?:red|rose)-\d{2,3}\b/i;

/** Each element that takes the `live` tone, with the tag it is on. */
const LIVE_TONE = /<([A-Z][\w.]*)\b(?:[^>]|=>)*?\btone=(?:"live"|'live'|\{[^}]*'live'[^}]*\})/g;

function liveRoleUses(source: string): string[] {
  const tones = [...source.matchAll(LIVE_TONE)]
    .filter(([, tag]) => tag !== 'Badge')
    .map(([use]) => use);
  const roles = [LIVE_ROLE, RED_VALUE].flatMap((pattern) => source.match(pattern) ?? []);
  return [...tones, ...roles];
}

describe('architecture: the live badge is the only use of the live role on the live surfaces', () => {
  it.each([
    { shape: 'a live ground', source: '<span className="tw:bg-live tw:text-on-live" />' },
    { shape: 'the live variable', source: "style={{ color: 'var(--live)' }}" },
    { shape: 'the live tone on a button', source: '<Button tone="live">Go</Button>' },
    { shape: 'a red hex', source: "const ALERT = '#e11d48';" },
    { shape: 'a red palette class', source: 'className="tw:text-red-600"' },
  ])('fires on $shape', ({ source }) => {
    expect(liveRoleUses(source)).not.toEqual([]);
  });

  it.each([
    { shape: 'the live badge', source: '<Badge variant="solid" tone="live">Live</Badge>' },
    {
      shape: 'a badge that is live only at the live edge',
      source: "<Badge variant={edge ? 'solid' : 'scrim'} tone={edge ? 'live' : 'neutral'}>",
    },
    { shape: 'the ink on live', source: 'className="tw:text-on-live"' },
    { shape: 'a word with red in it', source: 'const hovered = true;' },
  ])('leaves $shape alone', ({ source }) => {
    expect(liveRoleUses(source)).toEqual([]);
  });

  it('finds no other use of the live role or a red value on any live surface', () => {
    const surfaces = productionSources().filter((file) =>
      LIVE_SURFACES.some((surface) => surface.test(file))
    );

    expect(surfaces.length).toBeGreaterThan(0);
    expect(
      surfaces.flatMap((file) => liveRoleUses(read(file)).map((use) => `${file}: ${use}`))
    ).toEqual([]);
  });
});
