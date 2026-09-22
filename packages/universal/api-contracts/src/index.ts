import * as adminCategories from './admin-categories.js';
import * as adminDlq from './admin-dlq.js';
import * as adminVideos from './admin-videos.js';
import * as categories from './categories.js';
import * as channels from './channels.js';
import { type EndpointContract, isEndpoint } from './endpoint.js';
import * as events from './events.js';
import * as feed from './feed.js';
import * as health from './health.js';
import * as me from './me.js';
import * as reactions from './reactions.js';
import * as subscriptions from './subscriptions.js';
import * as uploads from './uploads.js';
import * as videos from './videos.js';

export * from './admin-categories.js';
export * from './admin-videos.js';
export * from './admin-dlq.js';
export * from './categories.js';
export * from './channels.js';
export * from './endpoint.js';
export * from './events.js';
export * from './feed.js';
export * from './health.js';
export * from './me.js';
export * from './pagination.js';
export * from './problem.js';
export * from './problem-for.js';
export * from './reactions.js';
export * from './subscriptions.js';
export * from './uploads.js';
export * from './video-resource.js';
export * from './videos.js';

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
