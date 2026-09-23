import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { Adapters, registerAdapters } from '@vp/adapters/composition';
import { Container, DisposeFailed } from '@vp/composition';
import type { AppConfig } from '@vp/env-schema';
import { isErr } from '@vp/result';
import fastify, { type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { type AdapterOverrides, overrideAdapters } from './composition/adapter-set';
import { registerOpenApi } from './composition/openapi';
import { Services, registerServices, resolveBackground } from './composition/services.module';
import { registerAuth } from './plugins/auth';
import { rateLimitProblem, registerErrorHandler } from './plugins/errors';
import { registerHttpMetricsPlugin } from './plugins/http-metrics';
import { routesFor } from './routes/index';

export * from './composition/adapter-set';
export * from './composition/services.module';
export * from './services/index';

export interface BuildAppOptions {
  config: AppConfig;
  adapters?: AdapterOverrides;
}

export interface ComposedApp {
  app: FastifyInstance;
  container: Container;
}

/**
 * Resolves the graph and registers every route, and starts nothing: `container.start()` is the
 * caller's to make, so a test that builds the app opens no subscription and leaves no timer.
 */
export async function composeApp(options: BuildAppOptions): Promise<ComposedApp> {
  const { config } = options;
  const container = overrideAdapters(
    await registerAdapters(new Container(), config),
    options.adapters
  );
  registerServices(container);

  const services = container.get(Services.ServiceSet);
  resolveBackground(container);

  const app = fastify({
    logger: false,
    trustProxy: [...config.http.trustProxy],
    bodyLimit: config.http.bodyLimitBytes,
  });
  app.decorate('services', services);
  app.decorate('config', config);

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(cors, { origin: [...config.http.corsOrigins] });
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: (req) => rateLimitProblem(req.url),
  });

  registerErrorHandler(app);

  await app.register(registerAuth, {
    channelService: services.channelService,
    verifier: container.get(Adapters.TokenVerifier),
    auth: config.auth,
  });
  await app.register(registerHttpMetricsPlugin);
  await registerOpenApi(app);

  for (const routes of routesFor(config.auth)) {
    await app.register(routes);
  }

  app.addHook('onClose', async () => {
    const disposed = await container.dispose();
    if (isErr(disposed)) throw new DisposeFailed(disposed.error);
  });

  return { app, container };
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  return (await composeApp(options)).app;
}
