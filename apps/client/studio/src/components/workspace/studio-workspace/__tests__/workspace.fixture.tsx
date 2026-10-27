import { render, screen } from '@testing-library/react';

import { AppProviders } from '#app/__tests__/providers';
import { StudioWorkspace } from '..';
import type { StudioWorkspaceRootProps } from '../studio-workspace';

const WIDTHS = { large: 1440, medium: 834, compact: 375 } as const;

export type Width = keyof typeof WIDTHS;

function viewportOf(width: number) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        media: query,
        matches: width >= Number(/min-width: (\d+)px/.exec(query)?.[1] ?? Infinity),
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList
  );
}

/** A library page in the workspace at `width`, with two nav items and an inspector for one video. */
export function renderWorkspace(
  width: Width = 'large',
  props: Partial<StudioWorkspaceRootProps> = {}
) {
  viewportOf(WIDTHS[width]);
  return render(
    <AppProviders>
      <StudioWorkspace.Root {...props}>
        <StudioWorkspace.Nav>
          <StudioWorkspace.NavItem icon="video" href="/videos" active>
            Videos
          </StudioWorkspace.NavItem>
          <StudioWorkspace.NavItem icon="chart" href="/analytics">
            Analytics
          </StudioWorkspace.NavItem>
        </StudioWorkspace.Nav>
        <StudioWorkspace.Toolbar>
          <button type="button">Upload</button>
        </StudioWorkspace.Toolbar>
        <StudioWorkspace.Content>Library</StudioWorkspace.Content>
        <StudioWorkspace.Inspector title="Lisbon at night">
          <p>Public</p>
        </StudioWorkspace.Inspector>
      </StudioWorkspace.Root>
    </AppProviders>
  );
}

/** The navigation column, ahead of the drawer's copy of it. */
export const rail = () => screen.getAllByRole('navigation', { name: 'Studio' })[0] as HTMLElement;
