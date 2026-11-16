import { CATEGORIES, CHANNEL_ADJECTIVES, CHANNEL_NOUNS, TITLE_TEMPLATES } from '../catalog';

describe('seed/catalog', () => {
  it('names categories by unique slugs the admin API accepts', () => {
    const slugs = CATEGORIES.map((category) => category.slug);

    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs.every((slug) => /^[a-z0-9-]+$/.test(slug))).toBe(true);
  });

  it('gives every title template a subject slot and enough channel names for the largest run', () => {
    expect(TITLE_TEMPLATES.every((template) => template.includes('{subject}'))).toBe(true);
    expect(CHANNEL_ADJECTIVES.length * CHANNEL_NOUNS.length).toBeGreaterThanOrEqual(100);
  });
});
