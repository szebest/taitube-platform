import { act, renderHook } from '@testing-library/react';
import { useCueWindow } from '../use-cue-window';

function scrollerOf(height: number): HTMLElement {
  const element = document.createElement('div');
  vi.spyOn(element, 'clientHeight', 'get').mockReturnValue(height);
  vi.spyOn(element, 'clientWidth', 'get').mockReturnValue(600);
  return element;
}

describe('apps/client/studio: useCueWindow', () => {
  it('mounts only the rows near the viewport of a long list, and stands in for the rest', () => {
    const { result } = renderHook(() => useCueWindow(1_000));

    act(() => result.current.scrollerRef(scrollerOf(320)));

    expect(result.current.rows.length).toBeLessThan(20);
    expect(result.current.rows[0]?.index).toBe(0);
    expect(result.current.totalSize).toBe((result.current.rows[0]?.size ?? 0) * 1_000);
  });

  it('mounts nothing for a list of no cues', () => {
    const { result } = renderHook(() => useCueWindow(0));

    act(() => result.current.scrollerRef(scrollerOf(400)));

    expect(result.current.rows).toEqual([]);
    expect(result.current.totalSize).toBe(0);
  });
});
