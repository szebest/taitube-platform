export * from './metrics';
export * from './logger';
export * from './tracing';
export * from './server';

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
