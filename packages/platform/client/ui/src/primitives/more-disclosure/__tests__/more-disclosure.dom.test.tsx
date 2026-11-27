import { axeViolations } from '@kit/web-testing/dom';
import { act, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MoreDisclosure, type MoreDisclosureProps } from '..';

type User = ReturnType<typeof userEvent.setup>;

const renderMore = (props: Partial<MoreDisclosureProps> = {}) => {
  const user = userEvent.setup();
  return {
    user,
    ...render(
      <div>
        <button type="button">Before</button>
        <MoreDisclosure
          content={
            <ul>
              <li>Drama</li>
            </ul>
          }
          openDelay={20}
          {...props}
        >
          2 more
        </MoreDisclosure>
        <p>Outside</p>
      </div>
    ),
  };
};

const trigger = () => screen.getByRole('button', { name: '2 more' });

describe('@kit/ui: MoreDisclosure', () => {
  it('renders only the closed trigger until it opens', () => {
    renderMore();

    expect(trigger()).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it.each([
    { how: 'keyboard focus', open: (user: User) => user.tab().then(() => user.tab()) },
    { how: 'click', open: (user: User) => user.click(trigger()) },
    { how: 'tap', open: (user: User) => user.pointer({ keys: '[TouchA]', target: trigger() }) },
    {
      how: 'Enter',
      open: async (user: User) => {
        act(() => trigger().focus());
        await user.keyboard('{Enter}');
      },
    },
    {
      how: 'Space',
      open: async (user: User) => {
        act(() => trigger().focus());
        await user.keyboard(' ');
      },
    },
    { how: 'a mouse resting on it', open: (user: User) => user.hover(trigger()) },
  ])('opens a dialog named by its trigger on $how', async ({ open }) => {
    const { user } = renderMore();

    await open(user);

    expect(await screen.findByRole('dialog', { name: '2 more' })).toHaveTextContent('Drama');
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
  });

  it('keeps a touch tap from opening it twice', async () => {
    const { user } = renderMore();

    await user.pointer({ keys: '[TouchA]', target: trigger() });

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it.each([
    { how: 'Escape', close: (user: User) => user.keyboard('{Escape}') },
    { how: 'a press outside', close: (user: User) => user.click(screen.getByText('Outside')) },
    { how: 'blur', close: (user: User) => user.tab() },
    { how: 'the mouse leaving', close: (user: User) => user.unhover(trigger()) },
  ])('closes on $how', async ({ how, close }) => {
    const { user } = renderMore();
    await (how === 'the mouse leaving' ? user.hover(trigger()) : user.click(trigger()));
    await screen.findByRole('dialog');
    if (how === 'blur') act(() => trigger().focus());

    await close(user);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('passes axe closed and open', async () => {
    const { user } = renderMore();
    expect(await axeViolations()).toEqual([]);

    await user.click(trigger());

    expect(await axeViolations()).toEqual([]);
  });
});
