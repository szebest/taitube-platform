import { POLL_OPTION_SLOTS } from '@vp/domain';

export const POST_LIMITS = {
  text: 2000,
  caption: 2000,
  alt: 200,
  comment: 500,
  question: 140,
  option: 60,
  explanation: 300,
  images: 4,
  optionsMin: 2,
  optionsMax: POLL_OPTION_SLOTS,
} as const;
