import { z } from 'zod';

export const CropRectSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const BannerLinkSchema = z
  .object({
    label: z.string().describe('1-24 characters of plain text after trimming'),
    url: z.string().describe('An https URL of up to 2048 characters'),
  })
  .meta({ id: 'BannerLink', description: 'The button the channel banner carries' });
