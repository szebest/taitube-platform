import { auth } from './auth';
import { channels } from './channels';
import { errors } from './errors';
import { studio } from './studio';
import { videos } from './videos';

export const en = { auth, channels, errors, studio, videos } as const;
