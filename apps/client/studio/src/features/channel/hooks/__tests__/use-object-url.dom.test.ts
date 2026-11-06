import { renderHook } from '@testing-library/react';
import { useObjectUrl } from '../use-object-url';

const FILE = new File(['a'], 'a.png', { type: 'image/png' });
const OTHER = new File(['b'], 'b.png', { type: 'image/png' });

describe('useObjectUrl', () => {
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockImplementation((file) => `blob:${(file as File).name}`);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  it('answers nothing without a file', () => {
    const { result } = renderHook(() => useObjectUrl(undefined));

    expect(result.current).toBeUndefined();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('answers a local address for the file and revokes it when the file changes and when it unmounts', () => {
    const { result, rerender, unmount } = renderHook(({ file }) => useObjectUrl(file), {
      initialProps: { file: FILE as File | undefined },
    });
    expect(result.current).toBe('blob:a.png');

    rerender({ file: OTHER });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:a.png');
    expect(result.current).toBe('blob:b.png');

    rerender({ file: undefined });
    expect(result.current).toBeUndefined();

    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:b.png');
  });
});
