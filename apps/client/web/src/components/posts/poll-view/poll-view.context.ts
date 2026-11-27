import { createCompoundContext } from '@kit/ui';

export const [PollViewContext, usePollView] = createCompoundContext<{
  revealed: boolean;
  votedIndex: number | null;
  correctIndex: number | null;
  voteDisabled: boolean;
  questionId: string;
  onVote: (index: number) => void;
}>('PollView');
