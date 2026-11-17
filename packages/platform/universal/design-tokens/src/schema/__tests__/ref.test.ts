import { RefSchema } from '../ref';
import { refFromTokens } from './tokens-json';

describe('RefSchema', () => {
  it('parses the ramps in tokens.json', () => {
    expect(RefSchema.safeParse(refFromTokens()).error).toBeUndefined();
  });

  it.each([
    { label: 'a step that is not a hex colour', ref: { sand: { 500: 'beige' } } },
    { label: 'a ramp name that is not kebab-case', ref: { Sand: { 500: '#8A8072' } } },
    { label: 'a step name with a space', ref: { signal: { 'red 300': '#F59298' } } },
  ])('rejects $label', ({ ref }) => {
    expect(RefSchema.safeParse(ref).success).toBe(false);
  });
});
