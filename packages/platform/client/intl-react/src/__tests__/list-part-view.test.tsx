import type { ListDetail } from '@kit/intl';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { ListPartView, type ListPartViewProps } from '../list-part-view';

const LONG = 'x'.repeat(200);

const DETAIL: ListDetail = {
  segments: [
    { type: 'item', value: 'Taitube' },
    { type: 'literal', value: ' و ' },
    { type: 'more', value: '٣ أخرى' },
  ],
  visible: ['Taitube'],
  hidden: ['Lisbon', LONG],
  total: 3,
  full: '',
  text: 'Taitube و ٣ أخرى',
};

const renderWithIntl = (props: Partial<ListPartViewProps> = {}) =>
  render(
    <div dir="rtl">
      <ListPartView detail={DETAIL} {...props} />
    </div>
  );

describe('@kit/intl-react: ListPartView', () => {
  it('isolates items and opens every item, a long one wrapping, from the more trigger', async () => {
    const { container } = renderWithIntl();

    await userEvent.click(screen.getByRole('button'));

    expect(container.querySelector('bdi')?.textContent).toBe('Taitube');
    expect(
      [...screen.getByRole('dialog').querySelectorAll('li > bdi')].map((node) => node.textContent)
    ).toEqual(['Taitube', 'Lisbon', LONG]);
    expect(screen.getByRole('dialog').className).toContain('wrap-break-word');
  });

  it('renders a custom trigger around the more text', () => {
    renderWithIntl({ moreTooltip: { trigger: (more) => <b>{more}!</b> } });

    expect(screen.getByRole('button').textContent).toBe('٣ أخرى!');
  });
});
