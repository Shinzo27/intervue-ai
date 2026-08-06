import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';

describe('ResponseInterceptor', () => {
  let interceptor: ResponseInterceptor<unknown>;
  let mockExecutionContext: ExecutionContext;

  beforeEach(() => {
    interceptor = new ResponseInterceptor();
    mockExecutionContext = {} as ExecutionContext;
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
});
