import { TOKEN_GROUPS } from '@vp/design-tokens';
import { appearance } from '../registry';

const { themes, defaultTheme, offer } = appearance;

describe('@vp/ui: the appearance registry', () => {
  it('offers each theme once, the default theme among them', () => {
    const ids = themes.map(({ id }) => id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(defaultTheme.id);
  });

  it.each(TOKEN_GROUPS)('offers each %s set once, every theme default among them', (group) => {
    const ids = offer[group].map(({ id }) => id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(themes.map(({ defaults }) => defaults[group].id)));
  });
});
