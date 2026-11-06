import { renderHook } from '@testing-library/react';
import { AppProviders } from '#app/__tests__/providers';
import {
  useChannelValidators,
  validateChannelImageFile,
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
    { kind: 'avatar', type: 'image/png', size: 1024, ok: true },
    { kind: 'avatar', type: 'image/gif', size: 1024, ok: false },
    { kind: 'avatar', type: 'image/png', size: 6 * 1024 * 1024, ok: false },
    { kind: 'banner', type: 'image/webp', size: 6 * 1024 * 1024, ok: true },
  ] as const)('judges a $kind of $type and $size bytes: $ok', ({ kind, type, size, ok }) => {
    const file = new File([new Uint8Array(size)], 'image', { type });

    expect(validateChannelImageFile(kind)({ value: [file] }) === undefined).toBe(ok);
  });

  it('has nothing to judge before a file is chosen', () => {
    expect(validateChannelImageFile('avatar')({ value: [] })).toBeUndefined();
  });

  it.each([
    { field: 'displayName', value: '   ', words: 'Use 1 to 100 characters.' },
    { field: 'displayName', value: 'x'.repeat(101), words: 'Use 1 to 100 characters.' },
    { field: 'displayName', value: 'The Creator', words: undefined },
    { field: 'bio', value: 'x'.repeat(1001), words: 'Use up to 1000 characters.' },
    { field: 'bio', value: '', words: undefined },
    { field: 'brandColor', value: '#FFFF00', words: undefined },
    { field: 'brandColor', value: '', words: undefined },
    { field: 'brandColor', value: 'blue', words: 'Use a colour like #3366cc.' },
    { field: 'brandColor', value: '#36c', words: 'Use a colour like #3366cc.' },
  ] as const)('words the $field check of "$value"', ({ field, value, words }) => {
    const { result } = renderHook(() => useChannelValidators(), { wrapper: AppProviders });

    expect(result.current[field]({ value })).toBe(words);
  });
});
