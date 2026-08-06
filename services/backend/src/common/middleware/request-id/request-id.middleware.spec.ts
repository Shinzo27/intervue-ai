import { Request, Response } from 'express';
import { RequestIdMiddleware } from './request-id.middleware';

describe('RequestIdMiddleware', () => {
  let middleware: RequestIdMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    middleware = new RequestIdMiddleware();
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      setHeader: jest.fn(),
    };
    nextFunction = jest.fn();
  });

  it('should generate a new X-Request-ID if missing from request headers', () => {
    middleware.use(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction,
    );

    const generatedId = mockRequest.headers?.['x-request-id'] as string;
    expect(generatedId).toBeDefined();
    expect(typeof generatedId).toBe('string');
    expect(generatedId.length).toBeGreaterThan(0);
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'X-Request-ID',
      generatedId,
    );
    expect(nextFunction).toHaveBeenCalled();
  });

  it('should reuse an existing X-Request-ID if present in request headers', () => {
    const existingId = 'custom-correlation-id-123';
    mockRequest.headers = { 'x-request-id': existingId };

    middleware.use(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction,
    );

    expect(mockRequest.headers['x-request-id']).toBe(existingId);
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'X-Request-ID',
      existingId,
    );
    expect(nextFunction).toHaveBeenCalled();
  });
});
