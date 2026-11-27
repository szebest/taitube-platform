import { isErr, isOk } from '@kit/result';
import { type PostPayloadInput, validatePostPayload } from '../payload';

const poll = (
  over: Partial<Extract<PostPayloadInput, { kind: 'poll' }>> = {}
): PostPayloadInput => ({
  kind: 'poll',
  question: 'Best codec?',
  options: ['AV1', 'H.264'],
  closesAt: null,
  ...over,
});

const quiz = (
  over: Partial<Extract<PostPayloadInput, { kind: 'quiz' }>> = {}
): PostPayloadInput => ({
  kind: 'quiz',
  question: 'Best codec?',
  options: ['AV1', 'H.264'],
  closesAt: null,
  correctIndex: 1,
  explanation: null,
  ...over,
});

describe('@vp/validation: poll and quiz payloads', () => {
  it.each<{ name: string; input: PostPayloadInput; normalized: PostPayloadInput }>([
    {
      name: 'a padded question and options',
      input: poll({ question: ' Best? ', options: [' a ', 'b '] }),
      normalized: poll({ question: 'Best?', options: ['a', 'b'] }),
    },
    {
      name: 'a question of 140 characters and six options of 60',
      input: poll({
        question: 'q'.repeat(140),
        options: Array.from({ length: 6 }, () => 'o'.repeat(60)),
      }),
      normalized: poll({
        question: 'q'.repeat(140),
        options: Array.from({ length: 6 }, () => 'o'.repeat(60)),
      }),
    },
    {
      name: 'a quiz whose blank explanation becomes null',
      input: quiz({ explanation: '  ' }),
      normalized: quiz({ explanation: null }),
    },
    {
      name: 'a quiz with an explanation of 300 characters',
      input: quiz({ explanation: 'e'.repeat(300) }),
      normalized: quiz({ explanation: 'e'.repeat(300) }),
    },
  ])('accepts $name', ({ input, normalized }) => {
    const result = validatePostPayload(input);

    expect(isOk(result) && result.value).toEqual(normalized);
  });

  it.each<{ name: string; input: PostPayloadInput; field: string }>([
    { name: 'a blank question', input: poll({ question: ' ' }), field: 'question' },
    {
      name: 'a question of 141 characters',
      input: poll({ question: 'q'.repeat(141) }),
      field: 'question',
    },
    { name: 'one option', input: poll({ options: ['a'] }), field: 'options' },
    {
      name: 'seven options',
      input: poll({ options: Array.from({ length: 7 }, () => 'o') }),
      field: 'options',
    },
    { name: 'a blank option', input: poll({ options: ['a', ' '] }), field: 'options.1' },
    {
      name: 'an option of 61 characters',
      input: poll({ options: ['a', 'o'.repeat(61)] }),
      field: 'options.1',
    },
    {
      name: 'a correct index past the options',
      input: quiz({ correctIndex: 2 }),
      field: 'correctIndex',
    },
    { name: 'a negative correct index', input: quiz({ correctIndex: -1 }), field: 'correctIndex' },
    {
      name: 'an explanation of 301 characters',
      input: quiz({ explanation: 'e'.repeat(301) }),
      field: 'explanation',
    },
  ])('refuses $name', ({ input, field }) => {
    const result = validatePostPayload(input);

    expect(isErr(result) && result.error).toMatchObject({ field });
  });
});
