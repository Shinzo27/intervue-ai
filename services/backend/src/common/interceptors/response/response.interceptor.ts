import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_RESPONSE_FORMAT_KEY } from './api-response-format.decorator';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    // Handlers marked @ApiResponseFormat() receive the raw payload (used by
    // the service-to-service internal API).
    const passthrough = Reflect.getMetadata(
      API_RESPONSE_FORMAT_KEY,
      context.getHandler(),
    );

    return next.handle().pipe(
      map((data) => {
        if (passthrough) {
          return data as ApiResponse<T>;
        }
        if (
          data !== null &&
          typeof data === 'object' &&
          'success' in data &&
          'data' in data
        ) {
          return data as ApiResponse<T>;
        }
        return {
          success: true,
          data,
        };
      }),
    );
  }
}
