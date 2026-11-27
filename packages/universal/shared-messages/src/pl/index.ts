import type { en } from '../en';
import { defineCatalogue } from '../engine';
import { accounts } from './accounts';
import { auth } from './auth';
import { browse } from './browse';
import { errorPage } from './error-page';
import { errors } from './errors';
import { ui } from './ui';
import { videos } from './videos';

export const pl = defineCatalogue<typeof en>()({
  accounts,
  auth,
  browse,
  errorPage,
  errors,
  ui,
  videos,
});
