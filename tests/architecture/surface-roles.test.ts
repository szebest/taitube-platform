import { read } from './repo-files';

const BASE = 'packages/client/ui/src/styles/base.css';
const PLAYER = 'apps/client/web/src/integrations/video-js/video-js-engine.tsx';

/** The rules that paint the page's ground: one for `html` and `body`, with the colour and the page background role. */
function groundRules(css: string): string[] {
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{}]+\{[^{}]*\}/g) ?? [];
  return rules
    .filter((rule) => /^[^{]*(?:^|[\s,])(?:html|body)\s*[,{]/.test(rule))
    .filter((rule) => /\bbackground\s*:/.test(rule));
}

const hasModeAttribute = (css: string, mode: 'dark' | 'light') =>
  css.includes(`[data-mode="${mode}"]`) && /color-scheme:\s*/.test(css);

describe('architecture: surface roles', () => {
  it('finds the ground rules of a stylesheet', () => {
    expect(
      groundRules('html, body { background: var(--bg); } .card { background: var(--surface); }')
    ).toHaveLength(1);
    expect(groundRules('body { background: #fff; } html { background: red; }')).toHaveLength(2);
    expect(groundRules('.page { background: var(--bg); }')).toEqual([]);
  });

  it('paints html and body once, from the page background role', () => {
    const rules = groundRules(read(BASE)).filter((rule) => !rule.includes('data-obs-overlay'));

    expect(rules).toHaveLength(1);
    expect(rules[0]).toContain('background: var(--bg)');
    expect(rules[0]).toContain('color: var(--fg)');
  });

  it('sets the colour scheme from the mode, once per mode', () => {
    expect(hasModeAttribute(read(BASE), 'dark')).toBe(true);
    expect(hasModeAttribute(read(BASE), 'light')).toBe(true);
    expect(hasModeAttribute('body { margin: 0 }', 'dark')).toBe(false);
  });

  it('draws the player on the media role in a dark mode, whatever the page theme', () => {
    const player = read(PLAYER);

    expect(player).toContain('data-mode="dark"');
    expect(player).toContain('bg-media');
    expect(player).not.toMatch(/data-theme/);
  });
});
