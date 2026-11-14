import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationParams = z.infer<typeof paginationSchema>;

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export function parsePagination(searchParams: URLSearchParams): PaginationParams {
  return paginationSchema.parse({
    page: searchParams.get('page') ?? undefined,
    perPage: searchParams.get('perPage') ?? undefined,
  });
}

export function toRange(params: PaginationParams): { from: number; to: number } {
  const from = (params.page - 1) * params.perPage;
  const to = from + params.perPage - 1;
  return { from, to };
}

export function buildMeta(params: PaginationParams, total: number): PaginationMeta {
  return {
    page: params.page,
    perPage: params.perPage,
    total,
    totalPages: Math.ceil(total / params.perPage),
  };
}
