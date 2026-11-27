import { type AnyProvider, provide, type Registry, type MissingProvider } from '@kit/di';
import { FormatPresets, type IntlBinding, type PresetTable } from '@kit/intl';
import { andThen, map, type Result } from '@kit/result';
import type { CatalogueSet, CatalogueShape, Translation } from './catalogue';
import type {
  ArgsFor,
  CheckConfig,
  ConfigFor,
  EngineOf,
  EngineTypes,
  MissingConfig,
  NeedsConfig,
  PresetsFor,
  ValidTemplate,
} from './engine-types';
import type { Kind } from './kind';
import type { AnyMessage, Message, MessageConfig } from './message';
import type { ParseTemplate } from './template';
import { Catalogues, ParamVocabulary } from './tokens';
import { createTranslator, type Translator } from './translator';

type ConfigArg<T extends string, C, E extends EngineTypes> = C &
  NoInfer<ConfigFor<ParseTemplate<T>, E> & CheckConfig<C, ParseTemplate<T>, E>>;

type Template<T extends string, E extends EngineTypes> = ValidTemplate<T, ParseTemplate<T>, E>;

type Unconfigured<T extends string, E extends EngineTypes> =
  NeedsConfig<ParseTemplate<T>, E> extends true ? MissingConfig<T> : Template<T, E>;

type Bare<T extends string, E extends EngineTypes> = Message<
  T,
  Record<never, never>,
  ArgsFor<ParseTemplate<T>, Record<never, never>, E>
>;

type Configured<T extends string, C extends MessageConfig, E extends EngineTypes> = Message<
  T,
  C,
  ArgsFor<ParseTemplate<T>, C, E>
>;

/** One app's typed `t`, over the catalogue type it registers. */
export interface I18n<App> {
  createTranslator(intl: IntlBinding, catalogues: CatalogueSet<App>): Translator<App>;
  /** The translator from a registry the app provided `Catalogues` and `FormatPresets` to. */
  fromRegistry(registry: Registry, intl: IntlBinding): Result<Translator<App>, MissingProvider>;
  /** `Catalogues`, `FormatPresets` and `ParamVocabulary`, for the app's composition root. */
  providers(catalogues: CatalogueSet<App>): readonly AnyProvider[];
}

export interface Engine<E extends EngineTypes> {
  dt<const T extends string>(template: Unconfigured<T, E>): Bare<T, E>;
  dt<const T extends string, const C extends MessageConfig>(
    template: Template<T, E>,
    config: ConfigArg<T, C, E>
  ): Configured<T, C, E>;
  /** Types another locale's catalogue against the source's, message by message, params both ways. */
  defineCatalogue<Source extends CatalogueShape>(): (
    translation: Translation<Source>
  ) => Translation<Source>;
  createI18n<App extends CatalogueShape>(): I18n<App>;
}

interface EngineDefinition<
  Kinds extends readonly Kind[],
  Presets extends PresetTable,
  Params extends readonly string[],
> {
  readonly kinds: Kinds;
  readonly presets: Presets;
  readonly params: Params;
}

/**
 * The message engine of one app, or of a server rendering its own text: every type it hands back
 * (templates, configs, catalogues, `t`) is checked against these kinds, presets and param names.
 */
export function defineEngine<
  const Kinds extends readonly Kind[],
  const Presets extends PresetTable,
  const Params extends readonly string[],
>(
  definition: EngineDefinition<Kinds, Presets & NoInfer<PresetsFor<Presets, Kinds>>, Params>
): Engine<EngineOf<Kinds, Presets, Params>> {
  type E = EngineOf<Kinds, Presets, Params>;
  const { kinds, presets, params } = definition;
  const kindsByName = new Map(kinds.map((kind) => [kind.name, kind]));

  function dt<const T extends string>(template: Unconfigured<T, E>): Bare<T, E>;
  function dt<const T extends string, const C extends MessageConfig>(
    template: Template<T, E>,
    config: ConfigArg<T, C, E>
  ): Configured<T, C, E>;
  function dt(template: string, config: MessageConfig = {}): AnyMessage {
    return Object.freeze({ template, config });
  }

  const engine: Engine<E> = {
    dt,
    defineCatalogue: () => (translation) => translation,
    createI18n: () => ({
      createTranslator: (intl, catalogues) =>
        createTranslator({ intl, catalogues, kinds: kindsByName, presets }),
      fromRegistry: (registry, intl) =>
        andThen(registry.get(Catalogues), (catalogues) =>
          map(registry.get(FormatPresets), (registered) =>
            createTranslator({ intl, catalogues, kinds: kindsByName, presets: registered })
          )
        ),
      providers: (catalogues) => [
        provide(Catalogues, catalogues),
        provide(FormatPresets, presets),
        provide(ParamVocabulary, params),
      ],
    }),
  };
  return Object.freeze(engine);
}
