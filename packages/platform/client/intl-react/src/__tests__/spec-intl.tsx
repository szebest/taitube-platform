import type { IntlBinding } from '@kit/intl';
import { unwrapOr } from '@kit/result';
import { IntlProvider, type IntlProviderProps } from '../intl-provider';

export interface SpecTranslator {
  readonly locale: string;
  readonly count: (value: number) => string;
}

declare module '../intl-context' {
  interface IntlRegister {
    translator: SpecTranslator;
  }
}

export function createSpecTranslator({ context, format }: IntlBinding): SpecTranslator {
  return {
    locale: context.locale,
    count: (value) => unwrapOr(format({ type: 'count', value }), ''),
  };
}

export type SpecIntlProps = Omit<IntlProviderProps, 'clock' | 'createTranslator'>;

export function SpecIntl(props: SpecIntlProps) {
  return (
    <IntlProvider
      {...props}
      clock={{ now: () => Date.now() }}
      createTranslator={createSpecTranslator}
    />
  );
}
