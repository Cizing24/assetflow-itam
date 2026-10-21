import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function errorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: Error & { statusCode?: number }, req, reply) => {
    let status = 500, code = 'INTERNAL_ERROR', message = '系統暫時無法完成操作。';
    if (error instanceof HttpError) { status = error.status; code = error.code; message = error.message; }
    else if (error instanceof ZodError) { status = 400; code = 'VALIDATION_ERROR'; message = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('；'); }
    else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') { status = 409; code = 'DUPLICATE'; message = '唯一欄位或有效業務紀錄已存在。'; }
      if (error.code === 'P2003') { status = 400; code = 'INVALID_REFERENCE'; message = '關聯資料不存在或無法刪除。'; }
      if (error.code === 'P2025') { status = 404; code = 'NOT_FOUND'; message = '找不到資料。'; }
    } else if (error.statusCode && error.statusCode < 500) { status = error.statusCode; code = status === 429 ? 'RATE_LIMITED' : 'INVALID_REQUEST'; message = status === 429 ? '嘗試次數過多，請稍後再試。' : '請求格式不正確。'; }
    if (status >= 500) req.log.error({ err: error, requestId: req.id }, 'Request failed');
    return reply.code(status).send({ error: { code, message, requestId: req.id } });
  });
  app.setNotFoundHandler((req, reply) => {
    if (app.hasReplyDecorator('sendFile') && req.method === 'GET' && !req.url.startsWith('/api/') && !req.url.startsWith('/assets/')) return reply.sendFile('index.html');
    return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '找不到此端點。', requestId: req.id } });
  });
}
