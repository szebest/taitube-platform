import type { Scenario } from '../scenario';
import { captions } from './captions';
import { categories } from './categories';
import { channelImages } from './channel-images';
import { channels } from './channels';
import { comments } from './comments';
import { featured } from './featured';
import { history } from './history';
import { identities } from './identities';
import { media } from './media';
import { playlists } from './playlists';
import { reactions } from './reactions';
import { reports } from './reports';
import { searches } from './searches';
import { subscriptions } from './subscriptions';
import { videos } from './videos';

/** In dependency order: identities, then the profile and taxonomy, then videos, then what hangs off them. */
export const SCENARIOS: readonly Scenario[] = [
  identities,
  categories,
  channels,
  channelImages,
  media,
  videos,
  captions,
  comments,
  reactions,
  subscriptions,
  playlists,
  history,
  searches,
  reports,
  featured,
];
