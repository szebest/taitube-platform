import { MS_PER_DAY, MS_PER_HOUR } from '@vp/domain/time';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { checkRoomInput } from '../watch-party-room-input';
import { START } from './watch-party-test-deps';

const LIMITS = { ceiling: 200, now: new Date(START) };
const IN_AN_HOUR = new Date(START + MS_PER_HOUR).toISOString();

describe('apps/server/api/services: checkRoomInput', () => {
  it('leaves alone what was not sent', () => {
    expect(expectOk(checkRoomInput({}, LIMITS))).toEqual({
      name: undefined,
      password: undefined,
      capacity: undefined,
      scheduledFor: undefined,
    });
  });

  it.each([
    {
      scenario: 'a name, tidied',
      input: { name: '  Movie   night ' },
      expected: { name: 'Movie night' },
    },
    {
      scenario: 'a password, kept as typed',
      input: { password: ' a b ' },
      expected: { password: ' a b ' },
    },
    { scenario: 'a password cleared', input: { password: null }, expected: { password: null } },
    { scenario: 'a capacity', input: { capacity: 10 }, expected: { capacity: 10 } },
    {
      scenario: 'the ceiling as a capacity',
      input: { capacity: 200 },
      expected: { capacity: 200 },
    },
    { scenario: 'a capacity cleared', input: { capacity: null }, expected: { capacity: null } },
    {
      scenario: 'a schedule as a date',
      input: { scheduledFor: IN_AN_HOUR },
      expected: { scheduledFor: new Date(IN_AN_HOUR) },
    },
    {
      scenario: 'a schedule cleared',
      input: { scheduledFor: null },
      expected: { scheduledFor: null },
    },
  ])('accepts $scenario', ({ input, expected }) => {
    expect(expectOk(checkRoomInput(input, LIMITS))).toMatchObject(expected);
  });

  it.each([
    { scenario: 'an empty name', input: { name: '   ' }, field: 'name' },
    { scenario: 'a name over sixty characters', input: { name: 'x'.repeat(61) }, field: 'name' },
    { scenario: 'a name with a link', input: { name: 'see https://example.com' }, field: 'name' },
    { scenario: 'a password under four characters', input: { password: 'abc' }, field: 'password' },
    { scenario: 'a capacity of one', input: { capacity: 1 }, field: 'capacity' },
    { scenario: 'a capacity over the ceiling', input: { capacity: 201 }, field: 'capacity' },
    {
      scenario: 'a schedule in the past',
      input: { scheduledFor: new Date(START - 1).toISOString() },
      field: 'scheduledFor',
    },
    {
      scenario: 'a schedule over thirty days out',
      input: { scheduledFor: new Date(START + 31 * MS_PER_DAY).toISOString() },
      field: 'scheduledFor',
    },
  ])('refuses $scenario, naming $field', ({ input, field }) => {
    expect(expectErr(checkRoomInput(input, LIMITS))).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field,
    });
  });
});
