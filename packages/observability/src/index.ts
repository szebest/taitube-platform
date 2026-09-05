export * from './metrics.js';
export * from './logger.js';
export * from './tracing.js';
export * from './server.js';

export interface ServiceInfo {
  name: string;
  version: string;
  environment: string;
}

export function createServiceInfo(
  name: string,
  version = 'dev',
  environment = 'development'
): ServiceInfo {
  return {
    name,
    version,
    environment,
  };
}
