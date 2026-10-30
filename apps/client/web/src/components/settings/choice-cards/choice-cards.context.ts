import { createCompoundContext } from '@vp/ui';

export const [ChoiceCardsContext, useChoiceCards] = createCompoundContext<{
  name: string;
  value: string;
  onValueChange: (value: string) => void;
}>('ChoiceCards');
