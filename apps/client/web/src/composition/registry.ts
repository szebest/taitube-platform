import { createRegistry } from '@kit/di';
import { MAX_WEB_VITALS_PER_BATCH, recordWebVitals } from '@vp/api-contracts';
import { APPEARANCE_COOKIES } from '@vp/domain/settings';
import { LOCALES } from '@vp/shared-messages/locales';
import { EMBED_PATH_PREFIX } from '#app/features/embed';
import {
  ACCOUNTS_MAX,
  API_BASE_URL,
  COOKIE_DOMAIN,
  DEV_TOKEN_URL,
  OTEL_TRACES_URL,
} from '#app/lib/config';
import { WEB_MESSAGES, WEB_SOURCE, webI18n } from '#app/lib/messages';

export const webComposition = {
  registry: createRegistry().provide(
    ...webI18n.providers({ locale: LOCALES.source, source: WEB_SOURCE, translations: {} })
  ),
  messages: WEB_MESSAGES,
  apiBaseUrl: API_BASE_URL,
  appearanceCookies: APPEARANCE_COOKIES,
  cookieDomain: COOKIE_DOMAIN,
  embeddablePrefix: EMBED_PATH_PREFIX,
  session: {
    apiBaseUrl: API_BASE_URL,
    cookieDomain: COOKIE_DOMAIN,
    devTokenUrl: DEV_TOKEN_URL,
    accountsMax: ACCOUNTS_MAX,
  },
  telemetry: {
    app: 'web',
    serviceName: 'taitube-web',
    apiBaseUrl: API_BASE_URL,
    vitals: { path: recordWebVitals.path, maxBatchSize: MAX_WEB_VITALS_PER_BATCH },
    tracesUrl: OTEL_TRACES_URL,
  },
} as const;
