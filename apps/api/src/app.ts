export interface ApiApp {
  name: string;
  version: string;
  status: 'initialized' | 'running' | 'stopped';
}

export function buildApp(): ApiApp {
  return {
    name: 'video-pipeline-api',
    version: '0.0.0',
    status: 'initialized',
  };
}
