import { useT } from '@kit/intl-react';
import { renderHook } from '@testing-library/react';
import { dt } from '@vp/messages';
import type { ReactNode } from 'react';
import { IntlProvider, type IntlProviderProps } from '../intl-provider';

function renderUseT(props: Omit<IntlProviderProps, 'children'>) {
  return renderHook(useT, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <IntlProvider {...props}>{children}</IntlProvider>
    ),
  });
}

describe('@vp/queries: IntlProvider', () => {
  it('translates in en, the source catalogue, when no translation is passed', () => {
    const { t } = renderUseT({ locale: 'en', timeZone: 'UTC' }).result.current;

    expect(t('channels.subscribers', { count: 1 })).toEqual({ ok: true, value: '1 subscriber' });
  });

  it('serves a translation passed beside en, falling back per key', () => {
    const catalogues: IntlProviderProps['catalogues'] = {
      sv: { errors: { forbidden: dt('Det får du inte göra.') } },
    };
    const { t } = renderUseT({ locale: 'sv', timeZone: 'UTC', catalogues }).result.current;

    expect(t('errors.forbidden')).toEqual({ ok: true, value: 'Det får du inte göra.' });
    expect(t('errors.internal')).toEqual({ ok: true, value: 'Something went wrong on our side.' });
  });
});
