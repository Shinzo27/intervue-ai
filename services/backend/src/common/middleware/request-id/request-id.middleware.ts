import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const REQUEST_ID_HEADER = 'X-Request-ID';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const existingHeader =
      req.headers['x-request-id'] ||
      req.headers[REQUEST_ID_HEADER.toLowerCase()];
    const requestId =
      typeof existingHeader === 'string' && existingHeader.trim().length > 0
        ? existingHeader
        : uuidv4();

    req.headers['x-request-id'] = requestId;
    (req as Request & { id?: string }).id = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    next();
  }
}
