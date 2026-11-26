import { defineCatalogue } from '@vp/shared-messages';
import type { en } from '../en';
import { appUi } from './app-ui';
import { studio } from './studio';

export const pl = defineCatalogue<typeof en>()({
  appUi,
  studio,
});
