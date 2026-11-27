import { defineMachine } from '@kit/machine';
import { API_TOKEN_EDGES, API_TOKEN_STATUSES } from '@vp/domain';

export const API_TOKEN = defineMachine({
  name: 'api-token',
  states: API_TOKEN_STATUSES,
  initial: ['active'],
  final: ['revoked'],
  events: API_TOKEN_EDGES,
});
