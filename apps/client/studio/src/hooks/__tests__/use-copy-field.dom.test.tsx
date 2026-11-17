import { renderHook, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { AppProviders } from '#app/__tests__/providers';
import { useCopyField } from '../use-copy-field';

async function copyField(clipboard: 'works' | 'refuses') {
  const user = userEvent.setup();
  if (clipboard === 'refuses') {
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
  }
  const { result } = renderHook(() => useCopyField(), { wrapper: AppProviders });
  await result.current('Stream key', 'sk_live_1');
  return user;
}

describe('apps/client/studio: useCopyField', () => {
  it('writes the value to the clipboard and says which field it copied', async () => {
    await copyField('works');

    expect(await navigator.clipboard.readText()).toBe('sk_live_1');
    expect(await screen.findByText('Copied: Stream key')).toBeInTheDocument();
  });

  it('says so when the browser refuses', async () => {
    await copyField('refuses');

    expect(await screen.findByText('Could not copy: Stream key')).toBeInTheDocument();
  });
});
