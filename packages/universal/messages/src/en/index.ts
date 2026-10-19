import { auth } from './auth';
import { browse } from './browse';
import { channels } from './channels';
import { errors } from './errors';
import { player } from './player';
import { search } from './search';
import { shell } from './shell';
import { studio } from './studio';
import { videos } from './videos';

export const en = { auth, browse, channels, errors, player, search, shell, studio, videos } as const;
