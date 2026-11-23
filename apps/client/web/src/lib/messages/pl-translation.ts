import type { Translation } from '@kit/i18n';
import { pl as sharedPl } from '@vp/messages/pl';
import { pl as ownPl } from '@vp/messages/web/pl';
import type { WebCatalogue } from './catalogue';

/** The web's Polish words, one lazy chunk: the shared translation and its own. */
export const pl: Translation<WebCatalogue> = { ...sharedPl, ...ownPl };
