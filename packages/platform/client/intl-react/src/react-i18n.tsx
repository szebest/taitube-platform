import type { ArgsOf, CatalogueSet, CatalogueShape, I18n, MessageKey, Translator } from '@kit/i18n';
import { createContext, type ReactNode, useContext } from 'react';
import { useIntlBindings } from './intl-context';
import { ListPartView, type ListPartViewProps } from './list-part-view';

/** @public */
export interface TranslatorProviderProps<App> {
  /** The source catalogue and the translations the active locale has loaded. */
  readonly catalogues: CatalogueSet<App>;
  readonly children: ReactNode;
}

/**
 * What `<Message>` renders: the key, its arguments (`{}` when it has none) and how a list opens.
 * @public
 */
export interface MessageProps<App, K extends MessageKey<App>> extends Pick<
  ListPartViewProps,
  'moreTooltip'
> {
  readonly id: K;
  readonly args: ArgsOf<App, K>;
  /** Rendered when the message cannot be rendered. */
  readonly fallback?: string;
}

/** One app's translator in React: its own context, so two apps' catalogues never meet in one type. */
export interface ReactI18n<App> {
  /** Builds the translator over the binding of the `IntlProvider` above it. */
  readonly TranslatorProvider: (props: TranslatorProviderProps<App>) => ReactNode;
  /** The translator, typed by the catalogue the app registered: a wrong key or argument fails to compile. */
  readonly useT: () => Translator<App>;
  /** `useT().parts`, for a UI that renders a list's "and N more" itself. */
  readonly useTParts: () => Translator<App>['parts'];
  /** A message as React: text as `useT` renders it, a list as `ListPartView` with its "and N more" opening the items. */
  readonly Message: <K extends MessageKey<App>>(props: MessageProps<App, K>) => ReactNode;
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

  function useTParts(): Translator<App>['parts'] {
    return useT().parts;
  }

  function Message<K extends MessageKey<App>>({
    id,
    args,
    moreTooltip,
    fallback = '',
  }: MessageProps<App, K>) {
    const { partsOr } = useT();
    return partsOr(id, args, [{ type: 'text', text: fallback }]).map((part) =>
      part.type === 'text' ? (
        part.text
      ) : (
        <ListPartView key={part.name} detail={part.detail} moreTooltip={moreTooltip} />
      )
    );
  }

  return { TranslatorProvider, useT, useTParts, Message };
}
