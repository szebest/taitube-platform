import { ok } from '@vp/result';
import { ALLOWED_CONTENT_TYPES, validateContentType, validateVideoMetadata } from '@vp/validation';
import type { Accept } from 'react-dropzone';

import { validateWith } from '#app/integrations/form/validate-with';

export const VIDEO_FILE_ACCEPT: Accept = Object.fromEntries(
  ALLOWED_CONTENT_TYPES.map((contentType) => [contentType, []])
);

export const validateVideoTitle = validateWith((title: string) => validateVideoMetadata({ title }));

export const videoTitleValidators = { onMount: validateVideoTitle, onChange: validateVideoTitle };

export const validateVideoDescription = validateWith((description: string) =>
  validateVideoMetadata({ description })
);

export const validateVideoFile = validateWith(([file]: File[]) =>
  file ? validateContentType(file.type, ALLOWED_CONTENT_TYPES) : ok(file)
);
