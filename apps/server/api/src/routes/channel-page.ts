import { getChannelPage } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { localeChainOf } from '../services/locale-chain';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function channelPageRoutes(app: FastifyInstance): Promise<void> {
  const { channelPageService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    getChannelPage.path,
    {
      schema: {
        ...contractSchema(getChannelPage),
        params: getChannelPage.params,
        querystring: getChannelPage.query,
      },
    },
    async (request, reply) => {
      const { tab, seed, locale } = request.query;
      const locales = localeChainOf(locale, request.headers['accept-language']);
      return sendResult(
        reply,
        request,
        await channelPageService.get(request.user ?? null, request.params.idOrHandle, {
          tab,
          seed,
          locales,
        })
      );
    }
  );
}
