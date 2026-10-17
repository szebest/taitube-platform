import { channels } from './channels';
import { errors } from './errors';
import { search } from './search';
import { shell } from './shell';
import { studio } from './studio';
import { videos } from './videos';

export const en = { channels, errors, search, shell, studio, videos } as const;
