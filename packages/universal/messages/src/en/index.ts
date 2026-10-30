import { auth } from './auth';
import { browse } from './browse';
import { channels } from './channels';
import { clips } from './clips';
import { errorPage } from './error-page';
import { errors } from './errors';
import { home } from './home';
import { live } from './live';
import { notifications } from './notifications';
import { player } from './player';
import { search } from './search';
import { settings } from './settings';
import { shell } from './shell';
import { shorts } from './shorts';
import { studio } from './studio';
import { ui } from './ui';
import { videos } from './videos';
import { watch } from './watch';

export const en = {
  auth,
  browse,
  channels,
  clips,
  errorPage,
  errors,
  home,
  live,
  notifications,
  player,
  search,
  settings,
  shell,
  shorts,
  studio,
  ui,
  videos,
  watch,
} as const;
