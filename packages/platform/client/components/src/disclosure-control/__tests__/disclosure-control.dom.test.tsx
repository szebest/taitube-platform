import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { renderWithCopy } from '../../__tests__/render-with-copy';
import { DisclosureControl, type DisclosureControlProps } from '../disclosure-control';

const renderControl = (props: Partial<DisclosureControlProps> = {}) => {
  const onValueChange = vi.fn();
  renderWithCopy(<DisclosureControl value="silent" onValueChange={onValueChange} {...props} />);
  return onValueChange;
};

describe('DisclosureControl', () => {
  it('names the group and offers Silent and Visible', () => {
    renderControl();

    expect(screen.getByRole('radiogroup', { name: 'disclosureLabel' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio').map((radio) => radio.textContent)).toEqual([
      'disclosureSilent',
      'disclosureVisible',
    ]);
  });

  it.each([
    { value: 'silent', checked: 'disclosureSilent' },
    { value: 'visible', checked: 'disclosureVisible' },
  ] as const)('marks $checked as chosen for $value', ({ value, checked }) => {
    renderControl({ value });

    expect(screen.getByRole('radio', { name: checked })).toBeChecked();
  });

  it('marks neither option while the channel default applies, and reports the first pick', async () => {
    const onValueChange = renderControl({ value: null });

    expect(screen.getAllByRole('radio').map((radio) => radio.getAttribute('aria-checked'))).toEqual(
      ['false', 'false']
    );
    await userEvent.click(screen.getByRole('radio', { name: 'disclosureSilent' }));

    expect(onValueChange).toHaveBeenCalledWith('silent');
  });

  it('reports the other option once it is picked', async () => {
    const onValueChange = renderControl({ value: 'silent' });

    await userEvent.click(screen.getByRole('radio', { name: 'disclosureVisible' }));

    expect(onValueChange).toHaveBeenCalledWith('visible');
  });

  it('lets a caller name the group for its own context', () => {
    renderControl({ 'aria-label': 'Tell the author' });

    expect(screen.getByRole('radiogroup', { name: 'Tell the author' })).toBeInTheDocument();
  });

  it('passes axe', async () => {
    renderControl();

    expect(await axeViolations()).toEqual([]);
  });
});
