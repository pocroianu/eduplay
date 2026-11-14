import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { ROUTES } from '@/shared/lib/constants/routes';

/**
 * Unit tests for route constants
 * Ensures all routes are correctly defined and dynamic routes work properly
 */
describe('ROUTES', () => {
  describe('static routes', () => {
    it('should have home route', () => {
      expect(ROUTES.HOME).toBe('/');
    });

    describe('AUTH routes', () => {
      it('should have login route', () => {
        expect(ROUTES.AUTH.LOGIN).toBe('/login');
      });

      it('should have register route', () => {
        expect(ROUTES.AUTH.REGISTER).toBe('/register');
      });

      it('should have student login route', () => {
        expect(ROUTES.AUTH.STUDENT_LOGIN).toBe('/login/elev');
      });

      it('should have forgot password route', () => {
        expect(ROUTES.AUTH.FORGOT_PASSWORD).toBe('/forgot-password');
      });
    });

    describe('TEACHER routes', () => {
      it('should have dashboard route', () => {
        expect(ROUTES.TEACHER.DASHBOARD).toBe('/teacher');
      });

      it('should have classes route', () => {
        expect(ROUTES.TEACHER.CLASSES).toBe('/teacher/classes');
      });

      it('should have new class route', () => {
        expect(ROUTES.TEACHER.CLASS_NEW).toBe('/teacher/classes/new');
      });

      it('should have students route', () => {
        expect(ROUTES.TEACHER.STUDENTS).toBe('/teacher/students');
      });

      it('should have new student route', () => {
        expect(ROUTES.TEACHER.STUDENT_NEW).toBe('/teacher/students/new');
      });

      it('should have activities route', () => {
        expect(ROUTES.TEACHER.ACTIVITIES).toBe('/teacher/activities');
      });

    });

    describe('STUDENT routes', () => {
      it('should have dashboard route', () => {
        expect(ROUTES.STUDENT.DASHBOARD).toBe('/student');
      });

      it('should have activities route', () => {
        expect(ROUTES.STUDENT.ACTIVITIES).toBe('/student/activities');
      });
    });

    describe('PARENT routes', () => {
      it('should have dashboard route', () => {
        expect(ROUTES.PARENT.DASHBOARD).toBe('/parent');
      });

      it('should have children route', () => {
        expect(ROUTES.PARENT.CHILDREN).toBe('/parent/children');
      });

      it('should have activities route', () => {
        expect(ROUTES.PARENT.ACTIVITIES).toBe('/parent/activities');
      });
    });

    describe('ADMIN routes', () => {
      it('should have dashboard route', () => {
        expect(ROUTES.ADMIN.DASHBOARD).toBe('/admin');
      });

      it('should have activities route', () => {
        expect(ROUTES.ADMIN.ACTIVITIES).toBe('/admin/cms/activities');
      });

      it('should have CMS activities route', () => {
        expect(ROUTES.ADMIN.CMS_ACTIVITIES).toBe('/admin/cms/activities');
      });
    });
  });

  describe('dynamic routes', () => {
    describe('TEACHER dynamic routes', () => {
      it('should generate class route with ID', () => {
        expect(ROUTES.TEACHER.CLASS('abc123')).toBe('/teacher/classes/abc123');
      });

      it('should generate student route with ID', () => {
        expect(ROUTES.TEACHER.STUDENT('student-456')).toBe('/teacher/students/student-456');
      });

      it('should generate class path progress route with IDs', () => {
        expect(ROUTES.TEACHER.CLASS_PATH_PROGRESS('class-123', 'path-456')).toBe(
          '/teacher/classes/class-123/paths/path-456',
        );
      });
    });

    describe('PARENT dynamic routes', () => {
      it('should generate child route with ID', () => {
        expect(ROUTES.PARENT.CHILD('child-123')).toBe('/parent/children/child-123');
      });
    });

    describe('ADMIN dynamic routes', () => {
      it('should generate activity CMS route with ID', () => {
        expect(ROUTES.ADMIN.CMS_ACTIVITY('activity-456')).toBe('/admin/cms/activities/activity-456');
      });
    });

    describe('PLAY routes', () => {
      it('should generate play route with ID', () => {
        expect(ROUTES.PLAY.ACTIVITY('counting-activity')).toBe('/play/counting-activity');
      });

      it('should handle UUID-like IDs', () => {
        const uuid = '550e8400-e29b-41d4-a716-446655440000';
        expect(ROUTES.PLAY.ACTIVITY(uuid)).toBe(`/play/${uuid}`);
      });
    });
  });

  describe('activity route pages', () => {
    it.each([
      ['teacher activities', 'src/app/(dashboard)/teacher/activities/page.tsx'],
      ['teacher create activity', 'src/app/(dashboard)/teacher/activities/create/page.tsx'],
      ['student activities', 'src/app/(dashboard)/student/activities/page.tsx'],
      ['parent activities', 'src/app/(dashboard)/parent/activities/page.tsx'],
      ['admin CMS activities', 'src/app/(dashboard)/admin/cms/activities/page.tsx'],
    ])('has a page for %s', (_label, pagePath) => {
      expect(existsSync(path.join(process.cwd(), pagePath))).toBe(true);
    });
  });

  describe('route type safety', () => {
    it('should return const type for dynamic routes', () => {
      // These type assertions ensure the routes are correctly typed as const
      const classRoute: `/teacher/classes/${string}` = ROUTES.TEACHER.CLASS('test');
      const gameRoute: `/play/${string}` = ROUTES.PLAY.ACTIVITY('test');

      expect(classRoute).toBeDefined();
      expect(gameRoute).toBeDefined();
    });
  });

  describe('route structure validation', () => {
    it('should have consistent route prefixes', () => {
      // All teacher routes should start with /teacher
      Object.values(ROUTES.TEACHER).forEach((value) => {
        if (typeof value === 'string') {
          expect(value).toMatch(/^\/teacher/);
        } else if (typeof value === 'function') {
          const route = value as (...segments: string[]) => string;
          expect(route('test', 'nested')).toMatch(/^\/teacher/);
        }
      });

      // All student routes should start with /student
      Object.values(ROUTES.STUDENT).forEach((value) => {
        if (typeof value === 'string') {
          expect(value).toMatch(/^\/student/);
        } else if (typeof value === 'function') {
          expect(value('test')).toMatch(/^\/student/);
        }
      });
    });

    it('should not have trailing slashes', () => {
      const checkRoutes = (obj: Record<string, unknown>) => {
        Object.values(obj).forEach((value) => {
          if (typeof value === 'string' && value !== '/') {
            expect(value).not.toMatch(/\/$/);
          } else if (typeof value === 'function') {
            const route = value as (...segments: string[]) => string;
            const result = route('test', 'nested');
            expect(result).not.toMatch(/\/$/);
          } else if (typeof value === 'object' && value !== null) {
            checkRoutes(value as Record<string, unknown>);
          }
        });
      };

      checkRoutes(ROUTES);
    });
  });
});
