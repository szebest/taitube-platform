import { API_TOKEN_EDGES, API_TOKEN_STATUSES } from '@vp/domain';
import { defineMachine } from '@vp/machine';

export const API_TOKEN = defineMachine({
  name: 'api-token',
  states: API_TOKEN_STATUSES,
  initial: ['active'],
  final: ['revoked'],
  events: API_TOKEN_EDGES,
});
