import { screen } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { renderRoute } from '@vp/web-testing/dom';

import { loaderApi } from '#app/__tests__/loader-api';
import { getRouter } from '#app/router';

async function renderHeader() {
  const rendered = await renderRoute(getRouter, '/', { handlers: loaderApi() });
  return { ...rendered, searchBox: await screen.findByRole('searchbox', { name: 'Search' }) };
}

function otherField() {
  const field = document.createElement('input');
  field.setAttribute('aria-label', 'Comment');
  document.body.append(field);
  onTestFinished(() => field.remove());
  return field;
}

describe('apps/client/web: shell header', () => {
  it('focuses the search box when the viewer presses /', async () => {
    const { user, searchBox } = await renderHeader();

    await user.keyboard('/');

    expect(searchBox).toHaveFocus();
    expect(searchBox).toHaveValue('');
  });

  it.each([
    { label: 'another field', field: otherField },
    { label: 'the search box', field: () => screen.getByRole('searchbox') },
  ])('types / into $label instead of moving focus', async ({ field }) => {
    const { user } = await renderHeader();
    const typedInto = field();

    await user.type(typedInto, 'a/b');

    expect(typedInto).toHaveFocus();
    expect(typedInto).toHaveValue('a/b');
  });

  it.each([
    { label: 'Enter', submit: (user: UserEvent) => user.keyboard('{Enter}') },
    {
      label: 'the search button',
      submit: (user: UserEvent) => user.click(screen.getByRole('button', { name: 'Search' })),
    },
  ])('opens the search page for the typed words on $label', async ({ submit }) => {
    const { user, router, searchBox } = await renderHeader();

    await user.type(searchBox, 'lofi beats');
    await submit(user);

    expect(router.state.location.pathname).toBe('/search');
    expect(router.state.location.search).toEqual({ q: 'lofi beats' });
  });

  it('clears the search box and keeps the focus in it', async () => {
    const { user, searchBox } = await renderHeader();

    await user.type(searchBox, 'lofi');
    await user.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(searchBox).toHaveValue('');
    expect(searchBox).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
  });
});
