import { renderSummary, seconds, styleFor } from '../output';

describe('demo: output', () => {
  it.each([
    { tty: false, env: {}, colored: false },
    { tty: true, env: { NO_COLOR: '1' }, colored: false },
    { tty: true, env: {}, colored: true },
  ])('colours $colored for tty $tty and env $env', ({ tty, env, colored }) => {
    expect(styleFor(tty, env).bold('x').includes('\u001b[')).toBe(colored);
  });

  it('formats seconds', () => {
    expect(seconds(1250)).toBe('1.3s');
  });

  it('renders services then personas, plain without colour', () => {
    const text = renderSummary(
      [{ label: 'Web', url: 'http://localhost:5173', note: 'viewer app' }],
      styleFor(false, {})
    );
    expect(text).toContain('Web  http://localhost:5173  viewer app');
    expect(text).toContain('moderator');
    expect(text).not.toContain('\u001b');
  });
});
