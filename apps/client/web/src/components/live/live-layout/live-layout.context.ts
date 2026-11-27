import { createCompoundContext } from '@kit/ui';
import type { LiveLayoutChatPlace } from './types';

export const [LiveLayoutContext, useLiveLayout] = createCompoundContext<{
  chat: LiveLayoutChatPlace;
}>('LiveLayout');
