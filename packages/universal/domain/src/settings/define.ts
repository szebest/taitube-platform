export const SETTING_SCOPES = ['device', 'account', 'both'] as const;
/** Where a value lives: on the device alone, on the account alone, or on both and merged. */
export type SettingScope = (typeof SETTING_SCOPES)[number];

/** A free value's check, by name: `@vp/domain-rules` runs it, this package cannot import it. */
export type TextKind = 'preferenceId' | 'accent' | 'languageTag';

type Options = readonly (string | number)[];

export interface ChoiceSetting<O extends Options = Options> {
  readonly type: 'choice';
  readonly options: O;
  readonly default: O[number];
  readonly scope: SettingScope;
}

export interface FlagSetting {
  readonly type: 'flag';
  readonly default: boolean;
  readonly scope: SettingScope;
}

/** A free string, `null` until chosen. */
export interface TextSetting {
  readonly type: 'text';
  readonly kind: TextKind;
  readonly default: null;
  readonly scope: SettingScope;
}

/** Token group to set id, merged key by key. */
export interface TokenOverridesSetting {
  readonly type: 'tokenOverrides';
  readonly default: Readonly<Record<string, string>>;
  readonly scope: SettingScope;
}

export type Setting = ChoiceSetting | FlagSetting | TextSetting | TokenOverridesSetting;

export type SectionDefinition = Readonly<Record<string, Setting>>;

export type SettingValue<S extends Setting> =
  S extends ChoiceSetting<infer O>
    ? O[number]
    : S extends FlagSetting
      ? boolean
      : S extends TextSetting
        ? string | null
        : Readonly<Record<string, string>>;

export type SectionValues<D extends SectionDefinition> = {
  readonly [K in keyof D]: SettingValue<D[K]>;
};

export function choice<const O extends Options>(
  setting: Omit<ChoiceSetting<O>, 'type'>
): ChoiceSetting<O> {
  return { type: 'choice', ...setting };
}

export function flag(setting: Omit<FlagSetting, 'type'>): FlagSetting {
  return { type: 'flag', ...setting };
}

export function text(setting: Omit<TextSetting, 'type' | 'default'>): TextSetting {
  return { type: 'text', default: null, ...setting };
}

export function tokenOverrides(
  setting: Omit<TokenOverridesSetting, 'type' | 'default'>
): TokenOverridesSetting {
  return { type: 'tokenOverrides', default: {}, ...setting };
}

export function defineSection<const D extends SectionDefinition>(definition: D): D {
  return definition;
}

export function sectionDefaults<D extends SectionDefinition>(definition: D): SectionValues<D> {
  const defaults = Object.entries(definition).map(([key, setting]) => [key, setting.default]);
  return Object.fromEntries(defaults) as SectionValues<D>;
}
