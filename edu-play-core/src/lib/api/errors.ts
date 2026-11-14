export const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  GONE: 'GONE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

const STATUS_MAP: Record<ErrorCode, number> = {
  [ERROR_CODES.UNAUTHORIZED]: 401,
  [ERROR_CODES.FORBIDDEN]: 403,
  [ERROR_CODES.NOT_FOUND]: 404,
  [ERROR_CODES.VALIDATION_ERROR]: 422,
  [ERROR_CODES.CONFLICT]: 409,
  [ERROR_CODES.RATE_LIMITED]: 429,
  [ERROR_CODES.GONE]: 410,
  [ERROR_CODES.INTERNAL_ERROR]: 500,
};

export class ApiError extends Error {
  public readonly code: ErrorCode;
  public readonly status: number;
  public readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = STATUS_MAP[code];
    this.details = details;
  }

  static unauthorized(message = 'Unauthorized'): ApiError {
    return new ApiError(ERROR_CODES.UNAUTHORIZED, message);
  }

  static forbidden(message = 'Forbidden'): ApiError {
    return new ApiError(ERROR_CODES.FORBIDDEN, message);
  }

  static notFound(resource = 'Resource'): ApiError {
    return new ApiError(ERROR_CODES.NOT_FOUND, `${resource} not found`);
  }

  static validation(message: string, details?: Record<string, unknown>): ApiError {
    return new ApiError(ERROR_CODES.VALIDATION_ERROR, message, details);
  }

  static gone(message = 'Resource is no longer available'): ApiError {
    return new ApiError(ERROR_CODES.GONE, message);
  }
}
