import { ok } from '@vp/result';
import { ALLOWED_CONTENT_TYPES, validateContentType, validateVideoMetadata } from '@vp/validation';

import { validateWith } from '#app/integrations/form/validate-with';

export const VIDEO_FILE_ACCEPT = {
  'video/mp4': ['.mp4'],
  'video/webm': ['.webm'],
  'video/quicktime': ['.mov'],
  'video/x-matroska': ['.mkv'],
} satisfies Record<(typeof ALLOWED_CONTENT_TYPES)[number], string[]>;

export const validateVideoTitle = validateWith((title: string) => validateVideoMetadata({ title }));

export const videoTitleValidators = { onMount: validateVideoTitle, onChange: validateVideoTitle };

export const validateVideoDescription = validateWith((description: string) =>
  validateVideoMetadata({ description })
);

export const validateVideoFile = validateWith(([file]: File[]) =>
  file ? validateContentType(file.type, ALLOWED_CONTENT_TYPES) : ok(file)
);
