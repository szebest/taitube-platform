import { BLUR_SHAPES, MAX_BLURS, VIDEO_EDIT_EDGES } from '../video-edits';

describe('@vp/domain: video edits', () => {
  it('holds up to twenty rectangles or ellipses', () => {
    expect([MAX_BLURS, BLUR_SHAPES]).toEqual([20, ['rect', 'ellipse']]);
  });

  it('starts a render again from any finished state, never over one in flight', () => {
    expect(VIDEO_EDIT_EDGES.render.from).not.toContain('rendering');
  });
});
