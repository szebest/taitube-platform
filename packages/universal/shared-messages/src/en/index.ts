import { accounts } from './accounts';
import { auth } from './auth';
import { browse } from './browse';
import { errorPage } from './error-page';
import { errors } from './errors';
import { ui } from './ui';
import { videos } from './videos';

/** The words both apps render, and the error copy a server may render too. */
export const en = {
  accounts,
  auth,
  browse,
  errorPage,
  errors,
  ui,
  videos,
} as const;
