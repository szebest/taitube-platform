import * as adminCategories from './admin-categories';
import * as adminDlq from './admin-dlq';
import * as adminVideos from './admin-videos';
import * as categories from './categories';
import * as channels from './channels';
import { type EndpointContract, isEndpoint } from './endpoint';
import * as events from './events';
import * as feed from './feed';
import * as health from './health';
import * as me from './me';
import * as reactions from './reactions';
import * as subscriptions from './subscriptions';
import * as uploads from './uploads';
import * as videos from './videos';

export * from './admin-categories';
export * from './admin-videos';
export * from './admin-dlq';
export * from './categories';
export * from './channels';
export * from './endpoint';
export * from './events';
export * from './feed';
export * from './health';
export * from './me';
export * from './pagination';
export * from './problem';
export * from './problem-for';
export * from './reactions';
export * from './subscriptions';
export * from './uploads';
export * from './video-resource';
export * from './videos';

export const contracts = {
  adminCategories,
  adminDlq,
  adminVideos,
  categories,
  channels,
  events,
  feed,
  health,
  me,
  reactions,
  subscriptions,
  uploads,
  videos,
} as const;

/** Every endpoint this API promises, flattened. The drift test walks this. */
export const API_ENDPOINTS: readonly EndpointContract[] = Object.values(contracts).flatMap(
  (group) => Object.values(group).filter(isEndpoint)
);

export function endpointKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
}

export function findEndpoint(method: string, path: string): EndpointContract | undefined {
  const key = endpointKey(method, path);
  return API_ENDPOINTS.find((endpoint) => endpointKey(endpoint.method, endpoint.path) === key);
}
