import { renderHook } from '@testing-library/react';
import { AppProviders } from '#app/__tests__/providers';
import {
  useValidatePlaylistDescription,
  useValidatePlaylistTitle,
} from '../use-validate-playlist-title';

describe('apps/client/web: the playlist field validators', () => {
  it.each([
    { scenario: 'a title', value: 'Road trips', message: undefined },
    { scenario: 'a blank title', value: '   ', message: expect.any(String) },
  ])('answers $scenario', ({ value, message }) => {
    const { result } = renderHook(useValidatePlaylistTitle, { wrapper: AppProviders });

    expect(result.current({ value })).toEqual(message);
  });

  it.each([
    { scenario: 'a description', value: 'Slow ways home', message: undefined },
    {
      scenario: 'a description past the limit',
      value: 'x'.repeat(5001),
      message: expect.any(String),
    },
  ])('answers $scenario for the description', ({ value, message }) => {
    const { result } = renderHook(useValidatePlaylistDescription, { wrapper: AppProviders });

    expect(result.current({ value })).toEqual(message);
  });
});
