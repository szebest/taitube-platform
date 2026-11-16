import { ok } from '@vp/result';
import { enumKind } from '../enum';
import { contextFor } from './context';

const LABELS = { ready: 'Ready', failed: 'Failed' };

describe('@kit/i18n: enumKind', () => {
  it('renders the label of its key', () => {
    expect(enumKind.format('{state:enum}', 'failed', LABELS, contextFor('en'))).toEqual(
      ok('Failed')
    );
  });

  it.each([
    { scenario: 'a key with no label', value: 'gone', entry: LABELS },
    { scenario: 'no labels', value: 'ready', entry: undefined },
    { scenario: 'labels that are not text', value: 'ready', entry: { ready: 1 } },
  ])('fails on $scenario', ({ value, entry }) => {
    expect(enumKind.format('{state:enum}', value, entry, contextFor('en'))).toEqual(
      expect.objectContaining({ ok: false })
    );
  });

  it('requires a config', () => {
    expect(enumKind.config).toBe('required');
  });
});
