import { auth } from './auth';
import { browse } from './browse';
import { channels } from './channels';
import { errors } from './errors';
import { home } from './home';
import { player } from './player';
import { search } from './search';
import { shell } from './shell';
import { studio } from './studio';
import { ui } from './ui';
import { videos } from './videos';

export const en = {
  auth,
  browse,
  channels,
  errors,
  home,
  player,
  search,
  shell,
  studio,
  ui,
  videos,
} as const;
