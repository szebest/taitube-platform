import type { Meta, StoryObj } from '@storybook/react-vite';
import { FALLBACK_ACTIVE_LOCALE, IntlProvider } from '@vp/queries/intl';
import { useState } from 'react';
import { STUDIO_MESSAGES } from '#app/lib/messages';
import { PostComposer, type PostComposerRootProps, type PostDraft, EMPTY_DRAFT } from '../index';

const PICTURE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

type ComposerArgs = Pick<PostComposerRootProps, 'mode' | 'pollLocked' | 'problem'> & {
  initial: Partial<PostDraft>;
};

function Composer({ initial, ...args }: ComposerArgs) {
  const [draft, setDraft] = useState<PostDraft>({ ...EMPTY_DRAFT, ...initial });

  return (
    <IntlProvider
      messages={STUDIO_MESSAGES}
      locale={FALLBACK_ACTIVE_LOCALE.locale}
      catalogues={FALLBACK_ACTIVE_LOCALE.catalogues}
      timeZone="UTC"
    >
      <div className="max-w-[40rem]">
        <PostComposer.Root draft={draft} onDraftChange={setDraft} {...args}>
          <PostComposer.Kinds />
          <PostComposer.Text />
          <PostComposer.Images onFiles={() => undefined} />
          <PostComposer.Poll />
          <PostComposer.Quiz />
          <PostComposer.Video>
            <p className="m-0 text-fg-muted">A picker goes here</p>
          </PostComposer.Video>
          <PostComposer.Playlist>
            <p className="m-0 text-fg-muted">A picker goes here</p>
          </PostComposer.Playlist>
          <PostComposer.Comments />
          <PostComposer.Schedule published={args.mode === 'edit' && initial.timing === 'now'} />
          <PostComposer.Problem />
        </PostComposer.Root>
      </div>
    </IntlProvider>
  );
}

const meta = {
  title: 'Studio/PostComposer',
  component: Composer,
  args: { initial: {} },
} satisfies Meta<typeof Composer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Text: Story = { args: { initial: { text: 'We ship the new studio on Friday.' } } };

export const OverTheLimit: Story = {
  args: {
    initial: { text: 'x'.repeat(2012) },
    problem: 'text must be between 1 and 2000 characters',
  },
};

export const Images: Story = {
  args: {
    initial: {
      kind: 'images',
      caption: 'Behind the scenes',
      images: [
        {
          key: 'a',
          fileName: 'a.png',
          previewUrl: PICTURE,
          uploadId: 'a',
          alt: 'The desk before the shoot',
          status: 'ready',
        },
        {
          key: 'b',
          fileName: 'b.png',
          previewUrl: PICTURE,
          uploadId: null,
          alt: '',
          status: 'uploading',
        },
      ],
    },
  },
};

export const Poll: Story = {
  args: {
    initial: {
      kind: 'poll',
      question: 'What should the next video be about?',
      options: ['Lighting', 'Audio', 'Editing'],
    },
  },
};

export const PollLocked: Story = {
  args: {
    mode: 'edit',
    pollLocked: true,
    initial: {
      kind: 'poll',
      question: 'What should the next video be about?',
      options: ['Lighting', 'Audio'],
      timing: 'now',
    },
  },
};

export const Quiz: Story = {
  args: {
    initial: {
      kind: 'quiz',
      question: 'Which frame rate is cinema?',
      options: ['24', '30', '60'],
      correctIndex: 0,
      explanation: 'Film has run at 24 frames a second since the sound era.',
    },
  },
};

export const Video: Story = {
  args: {
    initial: {
      kind: 'video_share',
      video: { id: 'v', title: 'The studio tour', durationMs: 640_000 },
      startMs: 125_000,
      comment: 'The bit about the lights starts here.',
    },
  },
};

export const Scheduled: Story = {
  args: { initial: { timing: 'schedule', publishAt: '2026-12-24T18:30', text: 'Happy holidays.' } },
};
