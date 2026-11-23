import { defineCatalogue } from '@vp/shared-messages';
import type { en } from '../en';
import { studio } from './studio';

export const pl = defineCatalogue<typeof en>()({
  studio,
});
