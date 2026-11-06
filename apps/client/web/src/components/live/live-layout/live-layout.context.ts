import { createCompoundContext } from '@vp/ui';
import type { LiveLayoutChatPlace } from './types';

export const [LiveLayoutContext, useLiveLayout] = createCompoundContext<{
  chat: LiveLayoutChatPlace;
}>('LiveLayout');
