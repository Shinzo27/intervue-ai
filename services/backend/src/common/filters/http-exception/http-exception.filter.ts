import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resBody = res as { message?: string | string[]; error?: string };
        if (Array.isArray(resBody.message)) {
          message = resBody.message.join(', ');
        } else if (resBody.message) {
          message = resBody.message;
        } else if (resBody.error) {
          message = resBody.error;
        }
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': {
          status = HttpStatus.CONFLICT;
          const target = exception.meta?.target;
          const targetStr = Array.isArray(target)
            ? target.join(', ')
            : typeof target === 'string'
              ? target
              : JSON.stringify(target);
          message = target
            ? `Unique constraint failed on: ${targetStr}`
            : 'Unique constraint failed';
          break;
        }
        case 'P2025': {
          status = HttpStatus.NOT_FOUND;
          message = 'Record not found';
          break;
        }
        case 'P2003': {
          status = HttpStatus.BAD_REQUEST;
          message = 'Foreign key constraint failed';
          break;
        }
        default: {
          status = HttpStatus.BAD_REQUEST;
          message = `Database error: ${exception.code}`;
          break;
        }
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Database validation error';
    } else if (
      exception instanceof Prisma.PrismaClientUnknownRequestError ||
      exception instanceof Prisma.PrismaClientInitializationError ||
      exception instanceof Prisma.PrismaClientRustPanicError
    ) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Database query error';
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const statusCode = Number(status);

    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.originalUrl || request.url} - ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json({
      success: false,
      message,
      timestamp: new Date().toISOString(),
      path: request.originalUrl || request.url,
    });
  }
}
