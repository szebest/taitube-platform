import { z } from 'zod';

export const CropRectSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const PrepareImageBodySchema = z.object({
  contentType: z.string().min(1).describe('image/jpeg, image/png or image/webp'),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .describe('At most 2 MB for an avatar or a playlist cover, 6 MB for a banner'),
});

export const PreparedImageSchema = z.object({
  uploadId: z.uuid().describe('What the completion is given once the file is uploaded'),
  uploadUrl: z.url(),
  headers: z.record(z.string(), z.string()).describe('Sent with the PUT, exactly as given'),
  expiresAt: z.iso.datetime(),
});

/** The completion of an upload: which one, and the pixels the browser decoded from it. */
export const UploadedImageSchema = z.object({
  uploadId: z.uuid(),
  width: z
    .number()
    .int()
    .positive()
    .describe('Pixels of the uploaded file, as the browser decoded it; the job reads it again'),
  height: z.number().int().positive(),
});

export const QueuedImageSchema = z.object({
  uploadId: z.uuid(),
  version: z
    .number()
    .int()
    .positive()
    .describe('The version the job writes, announced as `channel.image.ready`'),
});

export const BannerLinkSchema = z
  .object({
    label: z.string().describe('1-24 characters of plain text after trimming'),
    url: z.string().describe('An https URL of up to 2048 characters'),
  })
  .meta({ id: 'BannerLink', description: 'The button the channel banner carries' });
