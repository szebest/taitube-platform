import { token } from '@kit/di';
import type { PresetTable } from '@kit/intl';
import type { LooseCatalogueSet } from './catalogue';

/** The app's catalogues, the source locale's and its translations. */
export const Catalogues = token<LooseCatalogueSet>('Catalogues');

/** The app's named option sets per kind, from `definePresets`. */
export const FormatPresets = token<PresetTable>('FormatPresets');

/** The app's closed list of placeholder names, from `defineParams`. */
export const ParamVocabulary = token<readonly string[]>('ParamVocabulary');
