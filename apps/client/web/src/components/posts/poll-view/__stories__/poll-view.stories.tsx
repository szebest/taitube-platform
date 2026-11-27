import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { PollView } from '..';
import { PollViewRoot, type PollViewRootProps } from '../poll-view';

const frame: Decorator = (Story) => (
  <div className="max-w-[32rem] p-section">
    <Story />
  </div>
);

interface Option {
  text: string;
  votes: number | null;
  share: number;
}

function StoryPoll({
  options,
  footer,
  explanation,
  ...props
}: Omit<PollViewRootProps, 'children'> & {
  options: Option[];
  footer: string;
  explanation?: string;
}) {
  return (
    <PollView.Root {...props}>
      <PollView.Options>
        {options.map((option, index) => (
          <PollView.Option key={option.text} index={index} {...option} />
        ))}
      </PollView.Options>
      <PollView.Footer>{footer}</PollView.Footer>
      {explanation && <PollView.Explanation>{explanation}</PollView.Explanation>}
    </PollView.Root>
  );
}

const meta = {
  title: 'Web/PollView',
  tags: ['text', 'translated'],
  component: PollViewRoot,
  args: {
    question: 'Which tram next?',
    revealed: false,
    votedIndex: null,
    onVote: () => undefined,
  },
  parameters: { app: {} },
  decorators: [frame],
} satisfies Meta<typeof PollViewRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

const HIDDEN: Option[] = [
  { text: 'Line 28', votes: null, share: 0 },
  { text: 'Line 15', votes: null, share: 0 },
  { text: 'Line 12', votes: null, share: 0 },
];

const RESULTS: Option[] = [
  { text: 'Line 28', votes: 6, share: 60 },
  { text: 'Line 15', votes: 3, share: 30 },
  { text: 'Line 12', votes: 1, share: 10 },
];

export const Open: Story = {
  render: (args) => <StoryPoll {...args} options={HIDDEN} footer="Results show after you vote" />,
};

export const Voted: Story = {
  args: { revealed: true, votedIndex: 1 },
  render: (args) => (
    <StoryPoll {...args} options={RESULTS} footer="10 votes · Closes Nov 2, 2026" />
  ),
};

export const Closed: Story = {
  args: { revealed: true },
  render: (args) => <StoryPoll {...args} options={RESULTS} footer="10 votes · Voting has closed" />,
};

export const QuizRight: Story = {
  args: {
    question: 'Which year did line 28 open?',
    revealed: true,
    votedIndex: 1,
    correctIndex: 1,
  },
  render: (args) => (
    <StoryPoll
      {...args}
      options={[
        { text: '1914', votes: 1, share: 10 },
        { text: '1929', votes: 9, share: 90 },
      ]}
      footer="10 votes · You got it right"
      explanation="The first service ran in 1929."
    />
  ),
};

export const QuizWrong: Story = {
  args: {
    question: 'Which year did line 28 open?',
    revealed: true,
    votedIndex: 0,
    correctIndex: 1,
  },
  render: (args) => (
    <StoryPoll
      {...args}
      options={[
        { text: '1914', votes: 1, share: 10 },
        { text: '1929', votes: 9, share: 90 },
      ]}
      footer="10 votes · Not quite"
      explanation="The first service ran in 1929."
    />
  ),
};
