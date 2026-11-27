import { defineCatalogue } from '@vp/shared-messages';
import type { en } from '../en';
import { accountSettings } from './account-settings';
import { appUi } from './app-ui';
import { channels } from './channels';
import { clips } from './clips';
import { creatorStats } from './creator-stats';
import { feed } from './feed';
import { home } from './home';
import { library } from './library';
import { live } from './live';
import { notifications } from './notifications';
import { party } from './party';
import { player } from './player';
import { posts } from './posts';
import { pwa } from './pwa';
import { search } from './search';
import { settings } from './settings';
import { share } from './share';
import { shell } from './shell';
import { shorts } from './shorts';
import { signInPrompt } from './sign-in-prompt';
import { themeBuilder } from './theme-builder';
import { watch } from './watch';

export const pl = defineCatalogue<typeof en>()({
  accountSettings,
  appUi,
  channels,
  clips,
  creatorStats,
  feed,
  home,
  library,
  live,
  notifications,
  party,
  player,
  posts,
  pwa,
  search,
  settings,
  share,
  shell,
  shorts,
  signInPrompt,
  themeBuilder,
  watch,
});
