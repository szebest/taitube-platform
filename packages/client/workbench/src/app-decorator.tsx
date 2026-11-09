import type { Decorator } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import type { Account } from '@vp/api-contracts';
import { ApiProvider, AppWords, GUEST, type Session, SessionProvider } from '@vp/queries';
import { createToaster, ToastProvider, Tooltip } from '@vp/ui';
import { createContext, type PropsWithChildren, type ReactNode, use, useState } from 'react';
import { pickLocale } from './decorator';
import { type ApiReply, inMemoryApi } from './in-memory-api';
import { WebProviders } from './web-providers';

/** What a story asks of the app around it, under `parameters.app`; a story without it renders bare. */
export interface AppParameters {
  session?: 'guest' | 'signed-in';
  /** Built once per story render, so a closure over it is that render's own state. */
  api?: () => readonly ApiReply[];
}

const USER = {
  id: '0190c3a0-5e1d-7000-8000-00000000b001',
  email: 'viewer@example.com',
  tier: 'free',
  createdAt: '2026-01-01T00:00:00.000Z',
} as const;

export const VIEWER: Account = {
  ...USER,
  role: 'CREATOR',
  user: USER,
  channel: {
    id: '0190c3a0-5e1d-7000-8000-00000000c001',
    userId: USER.id,
    handle: 'viewer',
    displayName: 'The Viewer',
    avatarUrl: null,
    bannerUrl: null,
    brandColor: null,
    bio: null,
    links: [],
    subscriberCount: 0,
    videoCount: 0,
    totalViews: 0,
    live: null,
    autoCaptionsDefault: false,
    createdAt: USER.createdAt,
    updatedAt: USER.createdAt,
  },
};

const StoryContext = createContext<ReactNode>(null);

type ActiveWords = Parameters<typeof AppWords>[0]['active'];

const ActiveContext = createContext<ActiveWords | undefined>(undefined);

const PATHS = ['/', '/login', '/channel/$channelId', '/watch/$videoId'];

function createStoryRouter(
  Providers: (props: PropsWithChildren<{ active: ActiveWords | undefined }>) => ReactNode
) {
  function Stage() {
    return <Providers active={use(ActiveContext)}>{use(StoryContext)}</Providers>;
  }
  const root = createRootRoute({ component: Stage });
  const routeTree = root.addChildren(
    PATHS.map((path) => createRoute({ getParentRoute: () => root, path }))
  );
  return createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ['/'] }) });
}

function StoryApp({
  parameters,
  active,
  children,
}: {
  parameters: AppParameters;
  active: ActiveWords;
  children: ReactNode;
}) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      })
  );
  const [api] = useState(() => inMemoryApi(parameters.api?.() ?? []));
  const [toaster] = useState(createToaster);
  const session: Session =
    parameters.session === 'signed-in' ? { status: 'signed-in', account: VIEWER } : GUEST;
  const [router] = useState(() =>
    createStoryRouter(({ active: words, children: story }) => (
      <AppWords active={words}>
        <ApiProvider api={api}>
          <SessionProvider session={session}>
            <Tooltip.Provider>
              <ToastProvider toaster={toaster}>
                <WebProviders>{story}</WebProviders>
              </ToastProvider>
            </Tooltip.Provider>
          </SessionProvider>
        </ApiProvider>
      </AppWords>
    ))
  );

  return (
    <QueryClientProvider client={client}>
      <ActiveContext value={active}>
        <StoryContext value={children}>
          <RouterProvider router={router} />
        </StoryContext>
      </ActiveContext>
    </QueryClientProvider>
  );
}

/**
 * The app around a story that asks for it (`parameters.app`): a router at `/`, a query client, the API
 * answered in memory from the story's replies, the session, the locale's words, the toaster and the web
 * app's own contexts. The one place a kit component's providers are stood up.
 */
export const withApp: Decorator = (Story, { parameters, globals, loaded }) => {
  const app: AppParameters | undefined = parameters.app;
  if (app === undefined) return <Story />;

  const locale = pickLocale(globals);
  return (
    <StoryApp parameters={app} active={{ locale, catalogues: { [locale]: loaded.catalogue } }}>
      <Story />
    </StoryApp>
  );
};
