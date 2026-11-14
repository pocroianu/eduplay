import { z } from 'zod';
import {
  ApiError,
  handleRoute,
  parseQuery,
  requireRole,
  success,
} from '@/lib/api';
import {
  filtersToQueryOptions,
  getDraftArtifactsForTeacher,
  getSignedUrlsForArtifacts,
  parseTeacherPortfolioFilters,
} from '@/features/portfolio/server';

const teacherPortfolioDraftsQuerySchema = z.object({
  classId: z.string().optional(),
  studentId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  cursor: z.string().min(1).max(256).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
});

// GET /api/v1/teacher/portfolio/drafts — paginated review queue page
export const GET = handleRoute(async (req) => {
  const { supabase } = await requireRole('teacher');
  const url = new URL(req.url);
  const query = parseQuery(url.searchParams, teacherPortfolioDraftsQuerySchema);
  const filters = parseTeacherPortfolioFilters({
    classId: query.classId,
    studentId: query.studentId,
    from: query.from,
    to: query.to,
  });

  try {
    const page = await getDraftArtifactsForTeacher(supabase, {
      ...filtersToQueryOptions(filters),
      cursor: query.cursor ?? null,
      limit: query.limit,
    });

    const mediaUrls = await getSignedUrlsForArtifacts(supabase, page.items);

    return success(page.items, 200, {
      nextCursor: page.nextCursor,
      mediaUrls,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('invalid cursor')
    ) {
      throw ApiError.validation('Invalid cursor');
    }
    throw error;
  }
});
