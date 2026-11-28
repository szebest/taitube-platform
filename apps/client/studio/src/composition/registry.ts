import { createRegistry } from '@kit/di';
import type { TokenSetIds } from '@kit/ui';
import { MAX_WEB_VITALS_PER_BATCH, recordWebVitals } from '@vp/api-contracts';
import { APPEARANCE_COOKIES } from '@vp/domain/settings';
import { LOCALES } from '@vp/shared-messages/locales';
import {
  ACCOUNTS_MAX,
  API_BASE_URL,
  COOKIE_DOMAIN,
  DEV_TOKEN_URL,
  OTEL_TRACES_URL,
} from '#app/lib/config';
import { STUDIO_MESSAGES, STUDIO_SOURCE, studioI18n } from '#app/lib/messages';

const TOKEN_SET_DEFAULTS: TokenSetIds = { spacing: 'compact', sizing: 'small' };

export const studioComposition = {
  registry: createRegistry().provide(
    ...studioI18n.providers({ locale: LOCALES.source, source: STUDIO_SOURCE, translations: {} })
  ),
  messages: STUDIO_MESSAGES,
  apiBaseUrl: API_BASE_URL,
  appearanceCookies: APPEARANCE_COOKIES,
  cookieDomain: COOKIE_DOMAIN,
  tokenSetDefaults: TOKEN_SET_DEFAULTS,
  session: {
    apiBaseUrl: API_BASE_URL,
    cookieDomain: COOKIE_DOMAIN,
    devTokenUrl: DEV_TOKEN_URL,
    accountsMax: ACCOUNTS_MAX,
  },
  telemetry: {
    app: 'studio',
    serviceName: 'taitube-studio',
    apiBaseUrl: API_BASE_URL,
    vitals: { path: recordWebVitals.path, maxBatchSize: MAX_WEB_VITALS_PER_BATCH },
    tracesUrl: OTEL_TRACES_URL,
  },
} as const;
