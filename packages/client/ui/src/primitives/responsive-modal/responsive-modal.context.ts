import { createCompoundContext } from '../../lib/create-compound-context';

export const [ResponsiveModalContext, useResponsiveModal] = createCompoundContext<{
  compact: boolean;
  inline: boolean;
}>('ResponsiveModal');
