import type { DemoRunOptions } from './options';
import { stackApps } from './targets';

export interface Endpoint {
  label: string;
  url: string;
  note: string;
}

export interface Credentials {
  adminToken: string;
  storageUser: string;
  storagePassword: string;
}

export const CREDENTIAL_FALLBACKS: Credentials = {
  adminToken: 'change-me-32-bytes-random',
  storageUser: 'minioadmin',
  storagePassword: 'minioadmin',
};

export function endpoints(options: DemoRunOptions, credentials: Credentials): Endpoint[] {
  const apps = stackApps(options);
  const list: Endpoint[] = [];
  if (apps.includes('web'))
    list.push({ label: 'Web', url: 'http://localhost:5173', note: 'the viewer app' });
  if (apps.includes('studio')) {
    list.push({
      label: 'Studio',
      url: 'http://localhost:5174',
      note: 'creator app: upload and edit',
    });
  }
  if (apps.includes('api')) {
    list.push(
      { label: 'API', url: options.apiUrl, note: `health ${options.apiUrl}/healthz` },
      {
        label: 'API docs',
        url: `${options.apiUrl}/docs`,
        note: `OpenAPI ${options.apiUrl}/openapi.json`,
      },
      {
        label: 'Bull Board',
        url: `${options.apiUrl}/admin/queues`,
        note: `header x-admin-token: ${credentials.adminToken}`,
      }
    );
  }
  list.push({
    label: 'MinIO',
    url: 'http://localhost:9001',
    note: `${credentials.storageUser} / ${credentials.storagePassword}`,
  });
  if (options.observability) {
    list.push({ label: 'Grafana', url: 'http://localhost:3001', note: 'admin / admin' });
  }
  if (options.profile === 'full' && options.withWorker && options.only.length === 0) {
    list.push(
      { label: 'Live RTMP', url: 'rtmp://localhost:1935/live', note: 'broadcast from OBS' },
      { label: 'Live WHIP', url: 'http://localhost:8889/live', note: 'broadcast from a browser' }
    );
  }
  return list;
}
