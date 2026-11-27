import { BannerLinkSchema, CropRectSchema } from '../channel-images';

describe('packages/api-contracts: channel images', () => {
  it.each([
    {
      scenario: 'a whole-pixel rectangle',
      crop: { x: 0, y: 0, width: 400, height: 400 },
      ok: true,
    },
    { scenario: 'a negative origin', crop: { x: -1, y: 0, width: 400, height: 400 }, ok: false },
    { scenario: 'a fractional width', crop: { x: 0, y: 0, width: 4.5, height: 400 }, ok: false },
    { scenario: 'an empty height', crop: { x: 0, y: 0, width: 400, height: 0 }, ok: false },
  ])('checks $scenario', ({ crop, ok }) => {
    expect(CropRectSchema.safeParse(crop).success).toBe(ok);
  });

  it('leaves the label and address rules to the validation package', () => {
    expect(BannerLinkSchema.safeParse({ label: 'Shop', url: 'https://shop.example' }).success).toBe(
      true
    );
    expect(BannerLinkSchema.safeParse({ label: 'Shop' }).success).toBe(false);
  });
});
