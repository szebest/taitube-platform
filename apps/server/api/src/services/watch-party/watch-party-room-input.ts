import { andThen, map, ok, type Result } from '@vp/result';
import {
  type InvalidCapacity,
  type InvalidRoomName,
  type InvalidRoomPassword,
  type InvalidSchedule,
  validateCapacity,
  validateRoomName,
  validateRoomPassword,
  validateSchedule,
} from '@vp/validation';

export interface RoomInput {
  readonly name?: string;
  readonly password?: string | null;
  readonly capacity?: number | null;
  readonly scheduledFor?: string | null;
}

export interface CheckedRoomInput {
  readonly name: string | undefined;
  readonly password: string | null | undefined;
  readonly capacity: number | null | undefined;
  readonly scheduledFor: Date | null | undefined;
}

export type InvalidRoomInput =
  | InvalidRoomName
  | InvalidRoomPassword
  | InvalidCapacity
  | InvalidSchedule;

export interface RoomInputLimits {
  readonly ceiling: number;
  readonly now: Date;
}

function checkedPassword(
  password: string | null | undefined
): Result<string | null | undefined, InvalidRoomPassword> {
  return password === undefined || password === null
    ? ok(password)
    : validateRoomPassword(password);
}

function checkedSchedule(
  scheduledFor: string | null | undefined,
  now: Date
): Result<Date | null | undefined, InvalidSchedule> {
  if (scheduledFor === undefined) return ok(undefined);
  return validateSchedule(scheduledFor === null ? null : new Date(scheduledFor), now);
}

export function checkRoomInput(
  input: RoomInput,
  { ceiling, now }: RoomInputLimits
): Result<CheckedRoomInput, InvalidRoomInput> {
  const name = input.name === undefined ? ok(undefined) : validateRoomName(input.name);
  const capacity =
    input.capacity === undefined ? ok(undefined) : validateCapacity(input.capacity, ceiling);

  return andThen(name, (checkedName) =>
    andThen(checkedPassword(input.password), (password) =>
      andThen(capacity, (checkedCapacity) =>
        map(checkedSchedule(input.scheduledFor, now), (scheduledFor) => ({
          name: checkedName,
          password,
          capacity: checkedCapacity,
          scheduledFor,
        }))
      )
    )
  );
}
