import { renderHook } from '@testing-library/react';

import { AppProviders } from '#app/__tests__/providers';
import {
  isImageAddress,
  useChannelValidators,
  validateHandleField,
  validateLinksField,
  withoutBlankLinks,
} from '../channel-field-validators';

const valid = { label: 'Site', url: 'https://example.com' };

describe('apps/client/studio: channel field validators', () => {
  it.each([
    { handle: 'the.creator_1', ok: true },
    { handle: 'no spaces', ok: false },
    { handle: 'ab', ok: false },
  ])('answers the handle rule for "$handle"', ({ handle, ok }) => {
    expect(validateHandleField({ value: handle }) === undefined).toBe(ok);
  });

  it('drops the rows nothing was typed into', () => {
    expect(withoutBlankLinks([valid, { label: ' ', url: '' }, { label: 'Only', url: '' }])).toEqual(
      [valid, { label: 'Only', url: '' }]
    );
  });

  it.each([
    { scenario: 'no rows', links: [], valid: true },
    {
      scenario: 'a blank row beside a good one',
      links: [valid, { label: '', url: '' }],
      valid: true,
    },
    {
      scenario: 'a plain http address',
      links: [{ label: 'Site', url: 'http://example.com' }],
      valid: false,
    },
    {
      scenario: 'a row without a title',
      links: [{ label: '', url: 'https://example.com' }],
      valid: false,
    },
    { scenario: 'six links', links: Array.from({ length: 6 }, () => valid), valid: false },
  ])('judges $scenario', ({ links, valid: ok }) => {
    expect(validateLinksField({ value: links }) === undefined).toBe(ok);
  });

  it.each([
    { address: '', ok: true },
    { address: 'https://cdn.example.com/a.png', ok: true },
    { address: 'http://cdn.example.com/a.png', ok: false },
    { address: 'not an address', ok: false },
  ])('takes "$address" as an image address: $ok', ({ address, ok }) => {
    expect(isImageAddress(address)).toBe(ok);
  });

  it.each([
    { field: 'displayName', value: '   ', words: 'Use 1 to 100 characters.' },
    { field: 'displayName', value: 'x'.repeat(101), words: 'Use 1 to 100 characters.' },
    { field: 'displayName', value: 'The Creator', words: undefined },
    { field: 'bio', value: 'x'.repeat(1001), words: 'Use up to 1000 characters.' },
    { field: 'bio', value: '', words: undefined },
    {
      field: 'imageAddress',
      value: 'http://x.test/a.png',
      words: 'Use an https address, or leave it empty to remove the image.',
    },
  ] as const)('words the $field check of "$value"', ({ field, value, words }) => {
    const { result } = renderHook(() => useChannelValidators(), { wrapper: AppProviders });

    expect(result.current[field]({ value })).toBe(words);
  });
});
