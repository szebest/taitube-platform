import { IntlProvider, type IntlProviderProps } from '../intl-provider';

export type SpecIntlProps = Omit<IntlProviderProps, 'clock'>;

export function SpecIntl(props: SpecIntlProps) {
  return <IntlProvider {...props} clock={{ now: () => Date.now() }} />;
}
