import { ApiProvider, createAppApiClient } from '@vp/queries';
import { createEndpointMocks } from '@vp/web-testing';
import type { PropsWithChildren } from 'react';

import { API_BASE_URL } from '#app/config';

export const { mockEndpoint } = createEndpointMocks(API_BASE_URL);

export const api = createAppApiClient(API_BASE_URL);

/** The API client a hook under test reads through `useApi`. */
export function WithApi({ children }: PropsWithChildren) {
  return <ApiProvider api={api}>{children}</ApiProvider>;
}
