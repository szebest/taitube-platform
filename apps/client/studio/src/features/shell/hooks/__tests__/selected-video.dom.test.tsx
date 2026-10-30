import { renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

import { SelectedVideoContext, useSelectedVideo } from '../selected-video';

describe('apps/client/studio: selected video', () => {
  it('hands a library part the selection the shell holds', () => {
    const open = vi.fn();
    const wrapper = ({ children }: PropsWithChildren) => (
      <SelectedVideoContext value={{ videoId: 'v1', open }}>{children}</SelectedVideoContext>
    );

    const { result } = renderHook(() => useSelectedVideo('Page'), { wrapper });
    result.current.open('v2');

    expect(result.current.videoId).toBe('v1');
    expect(open).toHaveBeenCalledWith('v2');
  });

  it('refuses a part rendered outside the shell', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useSelectedVideo('Page'))).toThrow(
      'SelectedVideo.Page must be inside SelectedVideo.Root'
    );
  });
});
