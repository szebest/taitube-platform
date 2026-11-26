import { renderHook } from '@testing-library/react';
import { dt } from '@vp/shared-messages';
import type { ReactNode } from 'react';
import { SPEC_MESSAGES, useSpecT } from '../../__tests__/spec-messages';
import { IntlProvider, type IntlProviderProps } from '../intl-provider';
import { useT } from '../shared-words';

type Props = Omit<IntlProviderProps<typeof SPEC_MESSAGES.source>, 'children' | 'messages'>;

function renderTranslator(hook: typeof useT, props: Props) {
  return renderHook(hook, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <IntlProvider messages={SPEC_MESSAGES} {...props}>
        {children}
      </IntlProvider>
    ),
  });
}

describe('@vp/queries: IntlProvider', () => {
  it.each([
    { translator: 'the app', hook: useSpecT },
    { translator: 'the shared', hook: useT },
  ])('gives $translator translator the source catalogue when nothing is loaded', ({ hook }) => {
    const { t } = renderTranslator(hook, { locale: 'en', timeZone: 'UTC' }).result.current;

    expect(t('videos.views', { count: 1 })).toEqual({ ok: true, value: '1 view' });
  });

  it.each([
    { translator: 'the app', hook: useSpecT },
    { translator: 'the shared', hook: useT },
  ])('gives $translator translator the loaded translation, falling back per key', ({ hook }) => {
    const catalogues: Props['catalogues'] = {
      sv: { errors: { forbidden: dt('Det får du inte göra.') } },
    };
    const { t } = renderTranslator(hook, { locale: 'sv', timeZone: 'UTC', catalogues }).result
      .current;

    expect(t('errors.forbidden')).toEqual({ ok: true, value: 'Det får du inte göra.' });
    expect(t('errors.internal')).toEqual({ ok: true, value: 'Something went wrong on our side.' });
  });
});
