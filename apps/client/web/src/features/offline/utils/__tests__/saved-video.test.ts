import { SAVED_LIMITS, SavedVideoSchema } from '../saved-video';

const saved = { id: 'v1', title: 'Launch day', savedAt: 5, bytes: 10, urls: [] };

describe('apps/client/web: saved video', () => {
  it.each([
    { name: 'a record', value: saved, valid: true },
    { name: 'a record without its bytes', value: { ...saved, bytes: undefined }, valid: false },
    { name: 'a record with a numeric id', value: { ...saved, id: 1 }, valid: false },
  ])('parses $name: $valid', ({ value, valid }) => {
    expect(SavedVideoSchema.safeParse(value).success).toBe(valid);
  });

  it('keeps a video under the per-video budget the device can spare', () => {
    expect(SAVED_LIMITS.videos * SAVED_LIMITS.bytesPerVideo).toBeLessThanOrEqual(100 * 1024 * 1024);
  });
});
