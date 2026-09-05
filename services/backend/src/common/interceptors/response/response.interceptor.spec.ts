import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';
import { API_RESPONSE_FORMAT_KEY } from './api-response-format.decorator';

describe('ResponseInterceptor', () => {
  let interceptor: ResponseInterceptor<unknown>;
  let mockExecutionContext: ExecutionContext;
  let mockHandler: () => void;

  beforeEach(() => {
    interceptor = new ResponseInterceptor();
    mockHandler = () => void 0;
    mockExecutionContext = {
      getHandler: () => mockHandler,
    } as unknown as ExecutionContext;
  });

  it('should wrap response in { success: true, data }', (done) => {
    const mockData = { id: 'job_1', title: 'Software Engineer' };
    const mockCallHandler: CallHandler = {
      handle: () => of(mockData),
    };

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      next: (result) => {
        expect(result).toEqual({
          success: true,
          data: mockData,
        });
        done();
      },
    });
  });

  it('should handle null data cleanly', (done) => {
    const mockCallHandler: CallHandler = {
      handle: () => of(null),
    };

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      next: (result) => {
        expect(result).toEqual({
          success: true,
          data: null,
        });
        done();
      },
    });
  });

  it('should not double-wrap an already wrapped payload', (done) => {
    const mockData = { success: true, data: { id: 'job_1' } };
    const mockCallHandler: CallHandler = {
      handle: () => of(mockData),
    };

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      next: (result) => {
        expect(result).toEqual(mockData);
        done();
      },
    });
  });

  it('should pass through raw payload when @ApiResponseFormat is applied', (done) => {
    Reflect.defineMetadata(API_RESPONSE_FORMAT_KEY, true, mockHandler);

    const mockData = { id: 'int_1', status: 'IN_PROGRESS' };
    const mockCallHandler: CallHandler = {
      handle: () => of(mockData),
    };

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      next: (result) => {
        expect(result).toEqual(mockData);
        done();
      },
    });
  });
});
