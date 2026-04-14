import 'fastify';
import type { AppServices } from './service-contracts.js';

declare module 'fastify' {
  interface FastifyInstance {
    services: AppServices;
  }
}