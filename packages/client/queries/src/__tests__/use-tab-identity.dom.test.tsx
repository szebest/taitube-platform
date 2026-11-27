import {
  RouterProvider,
  createMemoryHistory,
  createRootRouteWithContext,
} from '@tanstack/react-router';
import { act, render, screen } from '@testing-library/react';
import { api } from '@vp/web-testing';
import { type AppRouterContext, createAppRouter } from '../app-router';
import { createIdentityStore } from '../identity-store';
import { useTabIdentity } from '../use-tab-identity';
import { SPEC_MESSAGES } from './spec-messages';

function Tab() {
  const { identity, prefixed } = useTabIdentity();
  return <p>{`slot ${identity.slot}, prefixed: ${prefixed}`}</p>;
}

describe('@vp/queries: useTabIdentity', () => {
  it("reads the router's identity, and follows it as it changes", async () => {
    const identity = createIdentityStore({ identity: { slot: 0 }, prefixed: false });
    const routeTree = createRootRouteWithContext<AppRouterContext>()({ component: Tab });
    const router = createAppRouter(
      {
        routeTree,
        messages: SPEC_MESSAGES,
        apiBaseUrl: 'http://localhost:3000',
        pending: () => null,
      },
      { api, history: createMemoryHistory({ initialEntries: ['/'] }), identity }
    );
    await router.load();
    render(<RouterProvider router={router} />);
    await screen.findByText('slot 0, prefixed: false');

    act(() => {
      identity.switchTo({ identity: { slot: 2 }, prefixed: true });
    });

    expect(screen.getByText('slot 2, prefixed: true')).toBeInTheDocument();
  });
});
