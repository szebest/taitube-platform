import { render, screen } from '@testing-library/react';
import { PartyQr } from '../party-qr';

const pathOf = (link: string) => {
  const { unmount } = render(<PartyQr link={link} label="QR code" />);
  const path = screen
    .getByRole('img', { name: 'QR code' })
    .querySelector('path')
    ?.getAttribute('d');
  unmount();
  return path;
};

describe('apps/client/web: PartyQr', () => {
  it('draws the link as a path, and another link as another one', () => {
    const first = pathOf('http://localhost:3000/parties/one');

    expect(first).toMatch(/^M\d+ \d+h1v1h-1z/);
    expect(pathOf('http://localhost:3000/parties/two')).not.toBe(first);
  });
});
