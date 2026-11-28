import type { ListDetail } from '@kit/intl';
import { act, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { FormatList, type FormatListProps } from '../format-list';
import { SpecIntl } from './spec-intl';

const GENRES = ['Action', 'Comedy', 'Drama', 'Horror'];
const MORE = { other: '{?} more' };

const list = (props: Partial<FormatListProps> = {}) => (
  <SpecIntl locale="en" timeZone="UTC">
    <FormatList value={GENRES} options={{ max: 2, more: MORE }} {...props} />
  </SpecIntl>
);

const renderWithIntl = (props: Partial<FormatListProps> = {}) => render(list(props));

describe('@kit/intl-react: FormatList', () => {
  it.each([
    { name: 'collapses past max', props: {}, text: 'Action, Comedy, and 2 more' },
    {
      name: 'shows all without max',
      props: { options: {} },
      text: 'Action, Comedy, Drama, and Horror',
    },
    {
      name: 'drops the tooltip when told to',
      props: { moreTooltip: false as const },
      text: 'Action, Comedy, and 2 more',
    },
    {
      name: 'renders the fallback when it cannot format',
      props: { value: [{ type: 'date', value: 'yesterday' }], fallback: '-' },
      text: '-',
    },
  ] as const)('$name', ({ props, text }) => {
    const { container } = renderWithIntl(props);

    expect(container.textContent).toBe(text);
  });

  it.each([
    { name: 'every item', props: {}, content: 'ActionComedyDramaHorror' },
    {
      name: 'the custom content',
      props: { moreTooltip: { content: ({ hidden }: ListDetail) => hidden.join('|') } },
      content: 'Drama|Horror',
    },
  ])('opens $name from the more trigger', async ({ props, content }) => {
    renderWithIntl(props);

    await userEvent.click(screen.getByRole('button', { name: '2 more' }));

    expect(screen.getByRole('dialog').textContent).toBe(content);
  });

  it('puts every item in a bdi so a name keeps its direction', () => {
    const { container } = renderWithIntl();

    expect([...container.querySelectorAll('bdi')].map((node) => node.textContent)).toEqual([
      'Action',
      'Comedy',
    ]);
  });

  it('hydrates the server markup without a mismatch', async () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(list());
    const onRecoverableError = vi.fn();

    await act(async () => {
      hydrateRoot(container, list(), { onRecoverableError });
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container.textContent).toBe('Action, Comedy, and 2 more');
  });
});
