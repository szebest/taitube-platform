import type { EditorPick } from '@vp/domain';
import { type UserContext, canManagePick } from '@vp/permissions';
import { type Result, andThen, err, ok } from '@vp/result';
import { type AuthorizationFailure, authorize } from '../authorize';
import { type PickNotFound, pickNotFound } from './failures';

export interface DeletePickInput {
  readonly actor: UserContext | null;
  readonly pick: EditorPick | null;
  readonly pickId: string;
}

export type DeletePickFailure = AuthorizationFailure | PickNotFound;

export function decidePickDelete(input: DeletePickInput): Result<EditorPick, DeletePickFailure> {
  return andThen(
    authorize(input.actor, canManagePick({ user: input.actor }), {
      action: 'delete',
      subject: 'Pick',
    }),
    () => (input.pick ? ok(input.pick) : err(pickNotFound(input.pickId)))
  );
}
