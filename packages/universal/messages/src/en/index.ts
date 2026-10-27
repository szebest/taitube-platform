import { auth } from './auth';
import { browse } from './browse';
import { channels } from './channels';
import { errors } from './errors';
import { home } from './home';
import { live } from './live';
import { notifications } from './notifications';
import { player } from './player';
import { search } from './search';
import { shell } from './shell';
import { shorts } from './shorts';
import { studio } from './studio';
import { ui } from './ui';
import { videos } from './videos';

export const en = {
  auth,
  browse,
  channels,
  errors,
  home,
  live,
  notifications,
  player,
  search,
  shell,
  shorts,
  studio,
  ui,
  videos,
} as const;
