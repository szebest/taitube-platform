import type { en } from '../en/studio-catalogue';
import { defineCatalogue } from '../engine';
import { studio } from './studio';

export const pl = defineCatalogue<typeof en>()({
  studio,
});
