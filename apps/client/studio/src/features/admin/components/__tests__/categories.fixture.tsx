import {
  createCategory,
  deleteCategory,
  listAdminCategories,
  listAdminPicks,
  listAdminVideos,
  listCommentReports,
  listDlq,
  updateCategory,
} from '@vp/api-contracts';
import { account, mockEndpoint } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { type HttpHandler, HttpResponse } from 'msw';

import { signInBrowser } from '#app/__tests__/providers';
import type { AdminCategory } from '#app/features/admin/api/admin-categories';
import { getRouter } from '#app/router';

let sequence = 0;

export function adminCategory(overrides: Partial<AdminCategory> = {}): AdminCategory {
  sequence += 1;
  return {
    id: `0190c3a0-5e1d-7000-8000-0000000d${String(sequence).padStart(4, '0')}`,
    slug: `category-${sequence}`,
    name: `Category ${sequence}`,
    description: null,
    iconUrl: null,
    sortOrder: sequence,
    isActive: true,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    videoCount: 0,
    ...overrides,
  };
}

/** The list the API answers for `/v1/admin/categories`. */
export const categoriesList = (categories: AdminCategory[]) =>
  mockEndpoint(listAdminCategories, () => HttpResponse.json(categories));

const emptyPage = { items: [], nextCursor: null };

/** Any admin page, signed in as an admin, over empty lists. */
export const adminSection = (url: string) =>
  renderRoute(getRouter, url, {
    handlers: [
      signInBrowser(account({ role: 'ADMIN' })),
      categoriesList([]),
      mockEndpoint(listAdminVideos, () => HttpResponse.json(emptyPage)),
      mockEndpoint(listCommentReports, () => HttpResponse.json(emptyPage)),
      mockEndpoint(listDlq, () => HttpResponse.json(emptyPage)),
      mockEndpoint(listAdminPicks, () => HttpResponse.json({ items: [] })),
    ],
  });

/** What the API was asked to change: bodies by endpoint, in the order they arrived. */
interface Requests {
  created: unknown[];
  updated: { id: string; body: unknown }[];
  deleted: string[];
}

/** `/admin/categories` as an admin sees it, over `categories`, with the writes recorded and answered. */
export async function renderCategories(
  categories: AdminCategory[],
  { handlers = [] }: { handlers?: HttpHandler[] } = {}
) {
  const requests: Requests = { created: [], updated: [], deleted: [] };
  const rendered = await renderRoute(getRouter, '/admin/categories', {
    handlers: [
      signInBrowser(account({ role: 'ADMIN' })),
      ...handlers,
      categoriesList(categories),
      mockEndpoint(createCategory, async ({ request }) => {
        requests.created.push(await request.json());
        return HttpResponse.json(adminCategory(), { status: 201 });
      }),
      mockEndpoint(updateCategory, async ({ request, params }) => {
        requests.updated.push({ id: String(params['id']), body: await request.json() });
        return HttpResponse.json(adminCategory());
      }),
      mockEndpoint(deleteCategory, ({ params }) => {
        requests.deleted.push(String(params['id']));
        return new HttpResponse(null, { status: 204 });
      }),
    ],
  });
  return { ...rendered, requests };
}
