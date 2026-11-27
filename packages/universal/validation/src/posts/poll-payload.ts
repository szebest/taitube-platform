import { type Result, andThen, err, map, ok } from '@kit/result';
import { type LengthBounds, normalizePlainText, withinLength } from '@kit/validation';
import {
  type InvalidPostPayload,
  invalidPostCorrectIndex,
  invalidPostOptionCount,
  invalidPostText,
} from './failures';

const POLL_OPTIONS = { min: 2, max: 6 } as const;
const QUESTION_BOUNDS: LengthBounds = { minLength: 1, maxLength: 140 };
const OPTION_BOUNDS: LengthBounds = { minLength: 1, maxLength: 60 };
const EXPLANATION_BOUNDS: LengthBounds = { minLength: 0, maxLength: 300 };

interface PollFields {
  readonly question: string;
  readonly options: string[];
  readonly closesAt: string | null;
}

export interface PollPayloadInput extends PollFields {
  readonly kind: 'poll';
}

export interface QuizPayloadInput extends PollFields {
  readonly kind: 'quiz';
  readonly correctIndex: number;
  readonly explanation: string | null;
}

function text(
  field: string,
  value: string,
  bounds: LengthBounds
): Result<string, InvalidPostPayload> {
  const normalized = normalizePlainText(value);
  return withinLength(normalized, bounds) ? ok(normalized) : err(invalidPostText(field, bounds));
}

function options(list: string[]): Result<string[], InvalidPostPayload> {
  if (list.length < POLL_OPTIONS.min || list.length > POLL_OPTIONS.max) {
    return err(invalidPostOptionCount({ minItems: POLL_OPTIONS.min, maxItems: POLL_OPTIONS.max }));
  }
  const checked: string[] = [];
  for (const [index, option] of list.entries()) {
    const result = text(`options.${index}`, option, OPTION_BOUNDS);
    if (!result.ok) return result;
    checked.push(result.value);
  }
  return ok(checked);
}

export function validatePollPayload<T extends PollFields>(
  payload: T
): Result<T, InvalidPostPayload> {
  return andThen(text('question', payload.question, QUESTION_BOUNDS), (question) =>
    map(options(payload.options), (checked) => ({ ...payload, question, options: checked }))
  );
}

export function validateQuizPayload(
  payload: QuizPayloadInput
): Result<QuizPayloadInput, InvalidPostPayload> {
  return andThen(validatePollPayload(payload), (poll) => {
    const inRange =
      Number.isInteger(poll.correctIndex) &&
      poll.correctIndex >= 0 &&
      poll.correctIndex < poll.options.length;
    if (!inRange) return err(invalidPostCorrectIndex(poll.options.length));
    if (poll.explanation === null) return ok(poll);
    return map(text('explanation', poll.explanation, EXPLANATION_BOUNDS), (explanation) => ({
      ...poll,
      explanation: explanation || null,
    }));
  });
}
