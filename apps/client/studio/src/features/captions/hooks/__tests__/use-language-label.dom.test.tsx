import { renderHook } from '@testing-library/react';
import { AppProviders } from '#app/__tests__/providers';
import { useLanguageLabel } from '../use-language-label';

describe('apps/client/studio: useLanguageLabel', () => {
  it.each([
    { language: 'en', label: 'English' },
    { language: 'pt-BR', label: 'Brazilian Portuguese' },
    { language: null, label: 'Language not detected yet' },
    { language: 'not a tag', label: 'not a tag' },
  ])('names $language as $label', ({ language, label }) => {
    const { result } = renderHook(() => useLanguageLabel(), { wrapper: AppProviders });

    expect(result.current(language)).toBe(label);
  });
});
