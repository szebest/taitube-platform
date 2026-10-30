import { createCompoundContext } from '@vp/ui';
import type { ChannelHeaderLayout } from './types';

export const [ChannelHeaderContext, useChannelHeader] = createCompoundContext<{
  layout: ChannelHeaderLayout;
  glowColor: string | undefined;
}>('ChannelHeader');
