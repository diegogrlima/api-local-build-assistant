import type { FastifyInstance } from 'fastify';
import { AppError } from '../shared/errors/app-error.js';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ code: error.code, message: error.message });
    }

    const statusCode =
      typeof (error as { statusCode?: unknown }).statusCode === 'number'
        ? (error as { statusCode: number }).statusCode
        : 500;

    if (statusCode >= 500) {
      request.log.error(error);
      return reply
        .status(500)
        .send({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro interno do servidor' });
    }

    const { message } = error as Error;
    return reply.status(statusCode).send({ code: 'BAD_REQUEST', message });
  });
}
