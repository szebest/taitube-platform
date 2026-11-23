import type { CatalogueSet, CatalogueShape, I18n, Translator } from '@kit/i18n';
import { createContext, type ReactNode, useContext } from 'react';
import { useIntlBindings } from './intl-context';

/** @public */
export interface TranslatorProviderProps<App> {
  /** The source catalogue and the translations the active locale has loaded. */
  readonly catalogues: CatalogueSet<App>;
  readonly children: ReactNode;
}

/** One app's translator in React: its own context, so two apps' catalogues never meet in one type. */
export interface ReactI18n<App> {
  /** Builds the translator over the binding of the `IntlProvider` above it. */
  readonly TranslatorProvider: (props: TranslatorProviderProps<App>) => ReactNode;
  /** The translator, typed by the catalogue the app registered: a wrong key or argument fails to compile. */
  readonly useT: () => Translator<App>;
}

export function createReactI18n<App extends CatalogueShape>(i18n: I18n<App>): ReactI18n<App> {
  const TranslatorContext = createContext<Translator<App> | undefined>(undefined);

  function TranslatorProvider({ catalogues, children }: TranslatorProviderProps<App>) {
    const { intl } = useIntlBindings('TranslatorProvider');
    return (
      <TranslatorContext value={i18n.createTranslator(intl, catalogues)}>
        {children}
      </TranslatorContext>
    );
  }

  function useT(): Translator<App> {
    const translator = useContext(TranslatorContext);
    if (translator === undefined) {
      throw new Error(
        'useT must be called inside <TranslatorProvider>, which supplies its catalogues'
      );
    }
    return translator;
  }

  return { TranslatorProvider, useT };
}
