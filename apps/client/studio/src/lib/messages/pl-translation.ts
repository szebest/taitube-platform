import type { Translation } from '@kit/i18n';
import { pl as sharedPl } from '@vp/shared-messages/pl';
import type { StudioCatalogue } from './catalogue';
import { pl as ownPl } from './pl';

/** The studio's Polish words, one lazy chunk: the shared translation and its own. */
export const pl: Translation<StudioCatalogue> = { ...sharedPl, ...ownPl };
