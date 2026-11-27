import { useFormat } from '@kit/intl-react';
import { unwrapOr } from '@kit/result';
import type { PostView } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { failureCode, useFailureToast, useVotePost } from '@vp/queries';
import { PollView } from '#app/components/posts/poll-view';
import { useRequireAccount } from '#app/hooks/use-require-account';
import { useT } from '#app/lib/messages';

export type PollBody = Extract<PostView['body'], { kind: 'poll' | 'quiz' }>;

const isSettled = (code: string) =>
  code === ErrorCodes.POST_ALREADY_VOTED || code === ErrorCodes.POST_POLL_CLOSED;

const percentOf = (votes: number | null, total: number | null) =>
  votes !== null && total ? (votes / total) * 100 : 0;

export function PostPoll({ post, body }: { post: PostView; body: PollBody }) {
  const { tOr } = useT();
  const { format } = useFormat();
  const showFailure = useFailureToast();
  const vote = useVotePost();
  const { run } = useRequireAccount('vote');
  const revealed = body.totalVotes !== null;
  const quiz = body.kind === 'quiz' ? body : null;
  const correctIndex = quiz?.correctIndex ?? null;

  const cast = (optionIndex: number) =>
    run(() =>
      vote.mutate(
        { postId: post.id, optionIndex },
        {
          onError: (error) =>
            !isSettled(failureCode(error)) && showFailure(tOr('posts.voteFailed', {}, ''), error),
        }
      )
    );

  return (
    <PollView.Root
      question={body.question}
      revealed={revealed}
      votedIndex={body.votedIndex}
      correctIndex={correctIndex}
      voteDisabled={vote.isPending}
      onVote={cast}
    >
      <PollView.Options>
        {body.options.map((option, index) => (
          <PollView.Option
            key={option.text}
            index={index}
            text={option.text}
            votes={option.votes}
            share={percentOf(option.votes, body.totalVotes)}
          />
        ))}
      </PollView.Options>
      <PollView.Footer>
        {body.totalVotes === null ? (
          <span>{tOr('posts.pollHidden', {}, '')}</span>
        ) : (
          <span>{tOr('posts.pollVotes', { count: body.totalVotes }, '')}</span>
        )}
        {body.closed ? (
          <span>{tOr('posts.pollClosed', {}, '')}</span>
        ) : (
          body.closesAt && (
            <span>
              {tOr(
                'posts.pollClosesAt',
                {
                  date: unwrapOr(
                    format({
                      type: 'dateTime',
                      value: body.closesAt,
                      options: { style: 'medium' },
                    }),
                    body.closesAt
                  ),
                },
                ''
              )}
            </span>
          )
        )}
        {quiz && body.votedIndex !== null && correctIndex !== null && (
          <span>
            {tOr(
              'posts.quizOutcome',
              { state: body.votedIndex === correctIndex ? 'correct' : 'wrong' },
              ''
            )}
          </span>
        )}
      </PollView.Footer>
      {quiz?.explanation && <PollView.Explanation>{quiz.explanation}</PollView.Explanation>}
    </PollView.Root>
  );
}
