import { RouterContextProvider } from '@tanstack/react-router';
import { renderHook } from '@testing-library/react';
import { appearance } from '@vp/ui/appearance/registry';
import type { ComponentType, PropsWithChildren } from 'react';

import { asViewer } from '#app/__tests__/providers';
import { getRouter } from '#app/router';
import { APPEARANCE_MODES } from '#app/features/search/command-actions';
import { useCommandActions } from '../use-command-actions';

const CREATOR = { id: 'creator-1', role: 'CREATOR', email: 'creator@test.local' } as const;

function renderActions(Viewer: ComponentType<PropsWithChildren>, router = getRouter()) {
  return renderHook(() => useCommandActions(), {
    wrapper: ({ children }) => (
      <Viewer>
        <RouterContextProvider router={router}>{children}</RouterContextProvider>
      </Viewer>
    ),
  }).result.current;
}

describe('apps/client/web: useCommandActions', () => {
  it('lists a theme for every registered theme and a mode for every mode', () => {
    const actions = renderActions(asViewer(null));

    expect(actions.filter(({ kind }) => kind === 'theme')).toEqual(
      appearance.themes.map(({ id, name }) => ({
        kind: 'theme',
        id,
        name,
        label: `Switch to ${name}`,
      }))
    );
    expect(actions.flatMap((action) => (action.kind === 'mode' ? [action.mode] : []))).toEqual(
      APPEARANCE_MODES
    );
  });

  it('omits History while /feed/history is not in the route tree', () => {
    const actions = renderActions(asViewer(null));

    expect(actions.some(({ kind }) => kind === 'page')).toBe(false);
  });

  it.each([
    { viewer: null, studio: false },
    { viewer: CREATOR, studio: true },
  ])('lists the studio for $viewer: $studio', ({ viewer, studio }) => {
    const actions = renderActions(asViewer(viewer));

    expect(actions.some(({ kind }) => kind === 'studio')).toBe(studio);
  });
});
