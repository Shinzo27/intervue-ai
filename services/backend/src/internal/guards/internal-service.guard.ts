import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class InternalServiceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    const authorization = request.headers.authorization;

    if (!authorization) {
      throw new UnauthorizedException(
        'Internal service authorization required',
      );
    }

    const [type, token] = authorization.split(' ');

    if (type !== 'Internal' || !token) {
      throw new UnauthorizedException('Invalid internal service authorization');
    }

    const expectedToken = process.env.INTERNAL_SERVICE_SECRET;

    if (!expectedToken) {
      throw new Error('INTERNAL_SERVICE_SECRET is not configured');
    }

    if (token !== expectedToken) {
      throw new UnauthorizedException('Invalid internal service token');
    }

    return true;
  }
}
