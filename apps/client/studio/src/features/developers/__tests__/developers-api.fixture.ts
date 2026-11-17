import {
  type ApiTokenView,
  createApiToken,
  createChannelExport,
  createWebhook,
  type DataExportView,
  deleteChannelExport,
  deleteWebhook,
  getChannelExport,
  listApiTokens,
  listChannelExports,
  listMyMemberships,
  listWebhooks,
  revokeApiToken,
  testWebhook,
  type WebhookTestView,
  type WebhookView,
} from '@vp/api-contracts';
import type { ChannelRole } from '@vp/domain';
import type { ErrorCode } from '@vp/errors';
import { CHANNEL_ID, mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

const CREATED_AT = '2026-03-01T12:00:00.000Z';
export const TOKEN_ID = '0190c3a0-5e1d-7000-8000-0000000ab001';
export const WEBHOOK_ID = '0190c3a0-5e1d-7000-8000-0000000ab002';
export const EXPORT_ID = '0190c3a0-5e1d-7000-8000-0000000ab003';
export const TEAM_CHANNEL_ID = '0190c3a0-5e1d-7000-8000-0000000ab004';
export const SECRET = `tt_pat_0a1b2c3d_${'f'.repeat(64)}`;
export const DOWNLOAD_URL = 'http://localhost:9000/raw/exports/file.csv?signature=1';

export const token = (overrides: Partial<ApiTokenView> = {}): ApiTokenView => ({
  id: TOKEN_ID,
  name: 'Nightly analytics sync',
  prefix: '0a1b2c3d',
  channelId: CHANNEL_ID,
  scopes: ['analytics:read'],
  expiresAt: '2026-05-30T12:00:00.000Z',
  lastUsedAt: null,
  requestsToday: 0,
  status: 'active',
  createdAt: CREATED_AT,
  ...overrides,
});

export const webhook = (overrides: Partial<WebhookView> = {}): WebhookView => ({
  id: WEBHOOK_ID,
  url: 'https://hooks.example.com/taitube',
  events: ['export.ready'],
  createdAt: CREATED_AT,
  ...overrides,
});

export const dataExport = (overrides: Partial<DataExportView> = {}): DataExportView => ({
  id: EXPORT_ID,
  kind: 'comments',
  format: 'csv',
  params: {},
  status: 'running',
  requestedBy: null,
  rowCount: null,
  failure: null,
  expiresAt: null,
  createdAt: CREATED_AT,
  ...overrides,
});

export interface DevelopersState {
  tokens: ApiTokenView[];
  webhooks: WebhookView[];
  exports: DataExportView[];
  /** What Send test answers. */
  testResult: WebhookTestView;
  /** The viewer's role on the team channel they act on; absent, they act on their own channel. */
  role?: ChannelRole;
  /** What creating a token, a webhook or an export is refused with. */
  createFailure?: ErrorCode;
}

/** The API behind the developer page: the state it answers from and what it was asked, the state moving with each write. */
export function serveDevelopers(initial: Partial<DevelopersState> = {}) {
  const state: DevelopersState = {
    tokens: [],
    webhooks: [],
    exports: [],
    testResult: { outcome: 'delivered' },
    ...initial,
  };
  const requests = {
    tokens: [] as unknown[],
    revoked: [] as string[],
    webhooks: [] as unknown[],
    removed: [] as string[],
    tested: [] as string[],
    exports: [] as unknown[],
    deletedExports: [] as string[],
  };
  const refuse = () => state.createFailure && problemReply(state.createFailure);

  const handlers = [
    mockEndpoint(listMyMemberships, () =>
      HttpResponse.json({
        items: state.role
          ? [
              {
                channelId: TEAM_CHANNEL_ID,
                ownerId: '0190c3a0-5e1d-7000-8000-0000000ab005',
                role: state.role,
                channel: { handle: 'teamshow', displayName: 'Team Show', avatarUrl: null },
              },
            ]
          : [],
      })
    ),
    mockEndpoint(listApiTokens, () => HttpResponse.json({ items: state.tokens })),
    mockEndpoint(createApiToken, async ({ request }) => {
      const body = (await request.json()) as Pick<ApiTokenView, 'name' | 'scopes'>;
      requests.tokens.push(body);
      const refused = refuse();
      if (refused) return refused;
      const made = token({ ...body });
      state.tokens = [made, ...state.tokens];
      return HttpResponse.json({ ...made, token: SECRET }, { status: 201 });
    }),
    mockEndpoint(revokeApiToken, ({ params }) => {
      requests.revoked.push(String(params.id));
      state.tokens = state.tokens.filter(({ id }) => id !== params.id);
      return new HttpResponse(null, { status: 204 });
    }),
    mockEndpoint(listWebhooks, () => HttpResponse.json({ items: state.webhooks })),
    mockEndpoint(createWebhook, async ({ request }) => {
      const body = (await request.json()) as Pick<WebhookView, 'url' | 'events'>;
      requests.webhooks.push(body);
      const refused = refuse();
      if (refused) return refused;
      const made = webhook(body);
      state.webhooks = [...state.webhooks, made];
      return HttpResponse.json({ ...made, secret: 'a'.repeat(64) }, { status: 201 });
    }),
    mockEndpoint(deleteWebhook, ({ params }) => {
      requests.removed.push(String(params.id));
      state.webhooks = state.webhooks.filter(({ id }) => id !== params.id);
      return new HttpResponse(null, { status: 204 });
    }),
    mockEndpoint(testWebhook, ({ params }) => {
      requests.tested.push(String(params.id));
      return HttpResponse.json(state.testResult);
    }),
    mockEndpoint(listChannelExports, () =>
      HttpResponse.json({ items: state.exports, nextCursor: null })
    ),
    mockEndpoint(createChannelExport, async ({ request }) => {
      const body = (await request.json()) as Pick<DataExportView, 'kind' | 'format' | 'params'>;
      requests.exports.push(body);
      const refused = refuse();
      if (refused) return refused;
      const made = dataExport({ ...body, status: 'queued' });
      state.exports = [made, ...state.exports];
      return HttpResponse.json(made, { status: 202 });
    }),
    mockEndpoint(getChannelExport, ({ params }) => {
      const held = state.exports.find(({ id }) => id === params.id);
      return HttpResponse.json({
        ...(held ?? dataExport()),
        downloadUrl: held?.status === 'ready' ? DOWNLOAD_URL : null,
      });
    }),
    mockEndpoint(deleteChannelExport, ({ params }) => {
      requests.deletedExports.push(String(params.id));
      state.exports = state.exports.filter(({ id }) => id !== params.id);
      return new HttpResponse(null, { status: 204 });
    }),
  ];

  return { state, requests, handlers };
}
