import { type ErrorCode, ErrorCodes } from '@vp/errors';
import type { ArgumentFreeKey } from '../../catalogue';
import { translatorFor } from '../fixtures';

const { t } = translatorFor('en');

t('videos.views', { count: 5 });
t('videos.publishedRelative', { when: '2026-09-22' });
t('videos.visibility', { visibility: 'public' });
t('errors.forbidden');

// @ts-expect-error a misspelt argument name
t('videos.views', { conut: 5 });

// @ts-expect-error a date placeholder takes an ISO string, not a number
t('videos.publishedRelative', { when: 5 });

// @ts-expect-error an enum placeholder takes one of its labelled members only
t('videos.visibility', { visibility: 'secret' });

// @ts-expect-error a message with placeholders cannot render without its arguments
t('videos.categories');

// @ts-expect-error a key that is not in the catalogue
t('videos.gone');

// @ts-expect-error copy for one code is not copy for every code
const _incompleteCopy: Readonly<Record<ErrorCode, ArgumentFreeKey>> = {
  [ErrorCodes.INTERNAL]: 'errors.internal',
};

// @ts-expect-error error copy cannot point at a message that needs arguments
const _copyWithArguments: ArgumentFreeKey = 'videos.views';
