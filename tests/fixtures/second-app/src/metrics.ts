import { createMetricsRegistry } from '@kit/observability';

export const createShopMetrics = () => createMetricsRegistry({ prefix: 'quill_' });
