import { builtInKinds, defineEngine, definePresets, type Engine, type EngineOf } from '@kit/i18n';
import { PARAMS } from './params';

const PRESETS = definePresets({});

export type AppEngine = EngineOf<typeof builtInKinds, typeof PRESETS, typeof PARAMS>;

/** The product's message engine: the built-in kinds, no presets yet, and the closed param vocabulary. */
const engine: Engine<AppEngine> = defineEngine({
  kinds: builtInKinds,
  presets: PRESETS,
  params: PARAMS,
});

type AppEngineApi = Engine<AppEngine>;

export const dt: AppEngineApi['dt'] = engine.dt;
export const defineCatalogue: AppEngineApi['defineCatalogue'] = engine.defineCatalogue;
export const createI18n: AppEngineApi['createI18n'] = engine.createI18n;
