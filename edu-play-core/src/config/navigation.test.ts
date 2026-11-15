import { describe, expect, it } from 'vitest';
import { ROLE_NAV_CONFIG } from './navigation';
import { ROUTES } from '@/shared/lib/constants';

describe('ROLE_NAV_CONFIG', () => {
  it('surfaces the EduPlay teacher workflows in navigation', () => {
    expect(ROLE_NAV_CONFIG.teacher.items).toEqual([
      expect.objectContaining({
        label: 'Panou',
        labelKey: 'nav.teacher.dashboard',
        href: ROUTES.TEACHER.DASHBOARD,
      }),
      expect.objectContaining({
        label: 'Biblioteci',
        labelKey: 'nav.teacher.librariesExplore',
        href: ROUTES.TEACHER.LIBRARIES_EXPLORE,
      }),
      expect.objectContaining({
        label: 'Biblioteca mea',
        labelKey: 'nav.teacher.library',
        href: ROUTES.TEACHER.LIBRARY,
      }),
    ]);
  });

  it('keeps removed teacher AI and messages routes out of desktop and bottom navigation', () => {
    const teacherNavItems = [
      ...ROLE_NAV_CONFIG.teacher.items,
      ...(ROLE_NAV_CONFIG.teacher.bottomNavItems ?? []),
    ];
    const removedTeacherRoutes = ['/teacher/' + 'ai', '/teacher/' + 'messages'];

    expect(teacherNavItems).not.toContainEqual(
      expect.objectContaining({
        href: removedTeacherRoutes[0],
      }),
    );
    expect(teacherNavItems).not.toContainEqual(
      expect.objectContaining({
        href: removedTeacherRoutes[1],
      }),
    );
  });

  it('does not surface the broken listen-tap authoring prototype in teacher navigation', () => {
    expect(ROLE_NAV_CONFIG.teacher.items).not.toContainEqual(
      expect.objectContaining({
        href: '/teacher/listen-tap',
      }),
    );
  });

  it('keeps a single admin content navigation target for activities', () => {
    const adminActivityItems = ROLE_NAV_CONFIG.admin.items.filter(
      (item) => item.href === ROUTES.ADMIN.CMS_ACTIVITIES,
    );

    expect(adminActivityItems).toEqual([
      expect.objectContaining({
        label: 'Activități',
        href: ROUTES.ADMIN.CMS_ACTIVITIES,
      }),
    ]);
  });
});
