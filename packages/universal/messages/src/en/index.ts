import { auth } from './auth';
import { browse } from './browse';
import { channels } from './channels';
import { clips } from './clips';
import { errorPage } from './error-page';
import { errors } from './errors';
import { home } from './home';
import { library } from './library';
import { live } from './live';
import { notifications } from './notifications';
import { player } from './player';
import { pwa } from './pwa';
import { search } from './search';
import { settings } from './settings';
import { share } from './share';
import { shell } from './shell';
import { shorts } from './shorts';
import { studio } from './studio';
import { themeBuilder } from './theme-builder';
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
  library,
  live,
  notifications,
  player,
  pwa,
  search,
  settings,
  share,
  shell,
  shorts,
  studio,
  themeBuilder,
  ui,
  videos,
  watch,
} as const;
