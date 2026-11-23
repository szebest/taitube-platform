import type { Translation } from '@kit/i18n';
import { pl as sharedPl } from '@vp/messages/pl';
import { pl as ownPl } from '@vp/messages/studio/pl';
import type { StudioCatalogue } from './catalogue';

/** The studio's Polish words, one lazy chunk: the shared translation and its own. */
export const pl: Translation<StudioCatalogue> = { ...sharedPl, ...ownPl };
