import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import { bindScreen } from './bind-screen';

function nextFileDocument(): Document {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  vi.stubGlobal('document', frame.contentDocument);
  return document;
}

describe('apps/web: a jsdom spec file that runs after another in the same worker', () => {
  it('renders a page for the test that follows to not see', () => {
    render(<p>left behind</p>);

    expect(screen.getByText('left behind')).toBeInTheDocument();
  });

  it('starts every test from an empty page', () => {
    expect(screen.queryByText('left behind')).toBeNull();
  });

  it('queries its own document through screen', () => {
    const next = nextFileDocument();
    next.body.innerHTML = '<p>only in this file</p>';

    bindScreen();

    expect(screen.getByText('only in this file').ownerDocument).toBe(next);
  });

  it('types into its own document through userEvent.setup()', async () => {
    const next = nextFileDocument();
    next.body.innerHTML = '<input aria-label="query" />';
    bindScreen();

    await userEvent.setup().type(screen.getByLabelText('query'), 'cats');

    expect(next.querySelector('input')?.value).toBe('cats');
  });
});
