import { axeViolations } from '@kit/web-testing/dom';
import { render, screen } from '@testing-library/react';
import { AlertBanner } from '../index';

const renderBanner = (detail = '26 subscribers') =>
  render(
    <AlertBanner.Root>
      <AlertBanner.Title>New subscriber!</AlertBanner.Title>
      <AlertBanner.Detail>{detail}</AlertBanner.Detail>
    </AlertBanner.Root>
  );

describe('AlertBanner', () => {
  it('announces its title and detail as a status', () => {
    renderBanner();

    expect(screen.getByRole('status')).toHaveTextContent('New subscriber!26 subscribers');
  });

  it('passes axe', async () => {
    renderBanner();

    expect(await axeViolations()).toEqual([]);
  });
});
