import { NextResponse } from 'next/server';

import { ApiError, ERROR_CODES } from './errors';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ApiResponse<T> {
  data: T | null;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  } | null;
  meta?: Record<string, unknown>;
}

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

/* ------------------------------------------------------------------ */
/*  Success helpers                                                    */
/* ------------------------------------------------------------------ */

export function success<T>(
  data: T,
  status: number = 200,
  meta?: Record<string, unknown>,
): NextResponse<ApiResponse<T>> {
  const body: ApiResponse<T> = { data, error: null, ...(meta && { meta }) };
  return NextResponse.json(body, { status });
}

export function paginated<T>(
  data: T[],
  pagination: PaginationMeta,
): NextResponse<ApiResponse<T[]>> {
  return success(data, 200, { pagination });
}

export function created<T>(data: T): NextResponse<ApiResponse<T>> {
  return success(data, 201);
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export function rawJson<T>(
  data: T,
  init?: ResponseInit,
): NextResponse<T> {
  return NextResponse.json(data, init);
}

/* ------------------------------------------------------------------ */
/*  Error helper                                                       */
/* ------------------------------------------------------------------ */

export function error(err: ApiError): NextResponse<ApiResponse<never>> {
  const body: ApiResponse<never> = {
    data: null,
    error: {
      code: err.code,
      message: err.message,
      ...(err.details && { details: err.details }),
    },
  };
  return NextResponse.json(body, { status: err.status });
}

/* ------------------------------------------------------------------ */
/*  Route wrapper                                                      */
/* ------------------------------------------------------------------ */

type RouteHandler = (
  req: Request,
  context?: { params: Promise<Record<string, string>> },
) => Promise<NextResponse>;

export function handleRoute(handler: RouteHandler): RouteHandler {
  return async (req, context) => {
    try {
      return await handler(req, context);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        return error(err);
      }

      console.error('[handleRoute] Unexpected error:', err);

      return error(
        new ApiError(
          ERROR_CODES.INTERNAL_ERROR,
          'An unexpected error occurred',
        ),
      );
    }
  };
}
