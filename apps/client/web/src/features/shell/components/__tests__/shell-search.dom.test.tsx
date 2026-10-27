import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { renderRoute } from '@vp/web-testing/dom';

import { loaderApi } from '#app/__tests__/loader-api';
import { getRouter } from '#app/router';

async function renderSearch(url = '/') {
  const rendered = await renderRoute(getRouter, url, { handlers: loaderApi() });
  return { ...rendered, searchBox: await screen.findByRole('searchbox', { name: 'Search' }) };
}

const appendedElements: HTMLElement[] = [];

afterEach(() => {
  for (const element of appendedElements.splice(0)) {
    element.remove();
  }
});

function appended<K extends keyof HTMLElementTagNameMap>(tag: K, role?: string) {
  const element = document.createElement(tag);
  element.tabIndex = 0;
  if (role) {
    element.setAttribute('role', role);
  }
  document.body.append(element);
  appendedElements.push(element);
  return element;
}

function pressSlashIn(role: string) {
  return async (user: UserEvent) => {
    appended('div', role).focus();
    await user.keyboard('/');
  };
}

describe('apps/client/web: shell search', () => {
  it('focuses the search box when the viewer presses /', async () => {
    const { user, searchBox } = await renderSearch();

    await user.keyboard('/');

    expect(searchBox).toHaveFocus();
    expect(searchBox).toHaveValue('');
  });

  it.each([
    { label: 'another field', field: () => appended('input') },
    { label: 'the search box', field: () => screen.getByRole('searchbox') },
  ])('types / into $label instead of moving focus', async ({ field }) => {
    const { user } = await renderSearch();
    const typedInto = field();

    await user.type(typedInto, 'a/b');

    expect(typedInto).toHaveFocus();
    expect(typedInto).toHaveValue('a/b');
  });

  it.each([
    {
      label: 'with a modifier',
      press: (user: UserEvent) => user.keyboard('{Control>}/{/Control}'),
    },
    { label: 'inside a menu', press: pressSlashIn('menu') },
    { label: 'inside a dialog', press: pressSlashIn('dialog') },
    {
      label: 'while composing text',
      press: () => fireEvent.keyDown(document.body, { key: '/', isComposing: true }),
    },
    {
      label: 'that something else handled',
      press: () => {
        const handled = (event: KeyboardEvent) => event.preventDefault();
        document.body.addEventListener('keydown', handled, { once: true });
        fireEvent.keyDown(document.body, { key: '/' });
      },
    },
  ])('leaves the focus alone on a / $label', async ({ press }) => {
    const { user, searchBox } = await renderSearch();

    await press(user);

    expect(searchBox).not.toHaveFocus();
  });

  it.each([
    { label: 'a search page opened directly', moves: [], shown: 'lofi' },
    { label: 'a search page gone back to', moves: ['/search?q=jazz', 'back'], shown: 'lofi' },
    {
      label: 'a search page gone forward to',
      moves: ['/search?q=jazz', 'back', 'forward'],
      shown: 'jazz',
    },
    { label: 'a page without a query', moves: ['/'], shown: '' },
  ])('shows the query of $label', async ({ moves, shown }) => {
    const { router } = await renderSearch('/search?q=lofi');

    for (const move of moves) {
      if (move === 'back') {
        router.history.back();
      } else if (move === 'forward') {
        router.history.forward();
      } else {
        await router.navigate({ href: move });
      }
    }

    await waitFor(() => expect(screen.getByRole('searchbox')).toHaveValue(shown));
  });

  it.each([
    {
      label: 'Enter',
      typed: '  lofi beats ',
      submit: (user: UserEvent) => user.keyboard('{Enter}'),
      path: '/search',
      search: { q: 'lofi beats' },
    },
    {
      label: 'the search button',
      typed: 'lofi beats',
      submit: (user: UserEvent) => user.click(screen.getByRole('button', { name: 'Search' })),
      path: '/search',
      search: { q: 'lofi beats' },
    },
    {
      label: 'Enter with blank words',
      typed: '   ',
      submit: (user: UserEvent) => user.keyboard('{Enter}'),
      path: '/',
      search: {},
    },
  ])('goes to $path for the trimmed words on $label', async ({ typed, submit, path, search }) => {
    const { user, router, searchBox } = await renderSearch();

    await user.type(searchBox, typed);
    await submit(user);

    expect(router.state.location.pathname).toBe(path);
    expect(router.state.location.search).toEqual(search);
  });

  it('clears the search box and keeps the focus in it', async () => {
    const { user, searchBox } = await renderSearch();

    await user.type(searchBox, 'lofi');
    await user.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(searchBox).toHaveValue('');
    expect(searchBox).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
  });
});
