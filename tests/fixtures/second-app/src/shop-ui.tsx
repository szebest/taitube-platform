import { UiCopyProvider, type UiCopyKey, uiCopyFrom } from '@kit/ui';
import type { PropsWithChildren } from 'react';

const SHOP_WORDS: Partial<Record<UiCopyKey, string>> = {
  retry: 'Yritä uudelleen',
  required: 'pakollinen',
  close: 'Sulje',
};

export const SHOP_UI_COPY = uiCopyFrom((key) => SHOP_WORDS[key] ?? key);

export function WithShopCopy({ children }: PropsWithChildren) {
  return <UiCopyProvider copy={SHOP_UI_COPY}>{children}</UiCopyProvider>;
}
