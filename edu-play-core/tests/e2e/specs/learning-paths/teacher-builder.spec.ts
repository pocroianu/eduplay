import { randomUUID } from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Page } from '@playwright/test';
import { studentPinToAuthPassword } from '../../../../src/features/auth/utils/student-auth-password';
import { expect, test } from '../../fixtures/auth.fixture';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost:54421';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function serviceClient(): SupabaseClient | null {
  if (!serviceKey) return null;
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function gotoAppPage(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
}

async function resetBrowserSession(page: Page, url: string): Promise<void> {
  await page.context().clearCookies();
  await gotoAppPage(page, url);
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
}

test.describe('Teacher learning-path builder', () => {
  test.describe('authenticated authoring flow', () => {
    test.skip(!serviceKey, 'Requires SUPABASE_SERVICE_ROLE_KEY for E2E seed data');

    const teacherId = randomUUID();
    const classId = randomUUID();
    const studentId = randomUUID();
    const firstActivityId = randomUUID();
    const secondActivityId = randomUUID();
    const firstVersionId = randomUUID();
    const secondVersionId = randomUUID();
    const email = `teacher-path-${Date.now()}@test.eduplay.ro`;
    const studentUsername = `ana-parcurs-${Date.now()}`;
    const studentEmail = `${studentUsername}@student.eduplay.ro`;
    const password = 'EduPlay-test-552!';
    const studentPin = '1234';
    let supabase: SupabaseClient;

    test.beforeAll(async () => {
      const client = serviceClient();
      if (!client) throw new Error('Missing service role client');
      supabase = client;

      const { error: userError } = await supabase.auth.admin.createUser({
        id: teacherId,
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: 'Profesor Parcurs',
          role: 'teacher',
        },
      });
      if (userError) throw userError;

      const { error: profileError } = await supabase.from('profiles').upsert({
        id: teacherId,
        email,
        full_name: 'Profesor Parcurs',
        role: 'teacher',
      });
      if (profileError) throw profileError;

      const { error: studentUserError } = await supabase.auth.admin.createUser({
        id: studentId,
        email: studentEmail,
        password: studentPinToAuthPassword(studentPin),
        email_confirm: true,
        user_metadata: {
          full_name: 'Ana Parcurs',
          role: 'student',
        },
      });
      if (studentUserError) throw studentUserError;

      const { error: studentProfileError } = await supabase.from('profiles').upsert({
        id: studentId,
        email: studentEmail,
        full_name: 'Ana Parcurs',
        role: 'student',
      });
      if (studentProfileError) throw studentProfileError;

      const { error: classError } = await supabase.from('classes').insert({
        id: classId,
        teacher_id: teacherId,
        name: 'Clasa Curajoșilor',
        grade_level: 'kindergarten',
        school_year: '2025-2026',
        is_active: true,
      });
      if (classError) throw classError;

      const { error: studentError } = await supabase.from('students').insert({
        id: studentId,
        username: studentUsername,
        class_id: classId,
      });
      if (studentError) throw studentError;

      const { error: typeError } = await supabase.from('activity_types').upsert([
        {
          type_id: 'drawing-canvas',
          display_name: 'Desen liber',
          category: 'creative',
          renderer_key: 'drawing-canvas',
          config_schema: {},
          version: 1,
        },
      ], { onConflict: 'type_id' });
      if (typeError) throw typeError;

      const { error: activityError } = await supabase.from('activities').insert([
        {
          id: firstActivityId,
          template: 'drawing-canvas',
          title: 'Activitate de numere',
          description: 'Activitate publicată pentru testul de parcurs.',
          category: 'math',
          difficulty: 'easy',
          target_age_min: 5,
          target_age_max: 8,
          estimated_duration: 5,
          is_published: true,
          status: 'published',
          visibility_scope: 'public',
          config_data: {},
          config_schema_version: 1,
        },
        {
          id: secondActivityId,
          template: 'drawing-canvas',
          title: 'Activitate de forme',
          description: 'A doua activitate publicată pentru testul de parcurs.',
          category: 'shapes',
          difficulty: 'easy',
          target_age_min: 5,
          target_age_max: 8,
          estimated_duration: 5,
          is_published: true,
          status: 'published',
          visibility_scope: 'public',
          config_data: {},
          config_schema_version: 1,
        },
      ]);
      if (activityError) throw activityError;

      const { error: versionError } = await supabase.from('activity_versions').insert([
        {
          id: firstVersionId,
          activity_id: firstActivityId,
          activity_type_id: 'drawing-canvas',
          version_number: 1,
          config_data: {},
          config_schema_version: 1,
        },
        {
          id: secondVersionId,
          activity_id: secondActivityId,
          activity_type_id: 'drawing-canvas',
          version_number: 1,
          config_data: {},
          config_schema_version: 1,
        },
      ]);
      if (versionError) throw versionError;
    });

    test.afterAll(async () => {
      if (!supabase) return;
      await supabase.from('student_path_progress').delete().eq('student_id', studentId);
      await supabase.from('learning_paths').delete().eq('created_by', teacherId);
      await supabase.from('activity_progress').delete().eq('student_id', studentId);
      await supabase.from('activity_versions').delete().in('id', [firstVersionId, secondVersionId]);
      await supabase.from('activities').delete().in('id', [firstActivityId, secondActivityId]);
      await supabase.from('students').delete().eq('id', studentId);
      await supabase.from('classes').delete().eq('id', classId);
      await supabase.from('profiles').delete().eq('id', studentId);
      await supabase.from('profiles').delete().eq('id', teacherId);
      await supabase.auth.admin.deleteUser(studentId);
      await supabase.auth.admin.deleteUser(teacherId);
    });

    test('covers create, publish, class assignment, student progress, matrix view, and teacher override', async ({
      loginPage,
      page,
    }) => {
      test.setTimeout(120000);

      await loginPage.goto();
      await loginPage.loginAsTeacher(email, password);
      await expect(page).toHaveURL(/\/teacher/, { timeout: 30000 });

      await gotoAppPage(page, '/teacher/paths');
      await page.getByTestId('learning-path-new').click();
      await expect(page).toHaveURL(/\/teacher\/paths\/new/);

      await page.getByTestId('learning-path-title').fill('Parcurs cu două activități');
      await page
        .getByTestId('learning-path-description')
        .fill('Exersează numerele în doi pași.');
      await page.getByTestId('learning-path-create').click();
      await expect(page).toHaveURL(/\/teacher\/paths\/[0-9a-f-]+/, {
        timeout: 30000,
      });

      await page.getByTestId('learning-path-step-target').selectOption('drawing-canvas');
      await page.getByTestId('learning-path-step-title').fill('Primul joc');
      await page.getByTestId('learning-path-add-step').click();
      await expect(page.getByTestId('learning-path-step')).toHaveCount(1, {
        timeout: 30000,
      });

      await page.getByTestId('learning-path-step-target').selectOption('drawing-canvas');
      await page.getByTestId('learning-path-step-title').fill('Al doilea joc');
      await page.getByTestId('learning-path-add-step').click();
      await expect(page.getByTestId('learning-path-step')).toHaveCount(2, {
        timeout: 30000,
      });

      await page.getByTestId('learning-path-publish').click();
      await expect(page).toHaveURL(/\/teacher\/paths$/, { timeout: 30000 });
      const card = page
        .getByTestId('learning-path-card')
        .filter({ hasText: 'Parcurs cu două activități' });
      await expect(card).toContainText('Publicat');
      await expect(card).toContainText('2 pași');
      const pathDetailHref = (await card.getByRole('link').getAttribute('href')) ?? '';
      const pathIdMatch = pathDetailHref.match(/\/teacher\/paths\/([0-9a-f-]+)/);
      expect(pathIdMatch?.[1]).toBeTruthy();
      const createdPathId = pathIdMatch![1];
      const { data: stepRows, error: stepRowsError } = await supabase
        .from('learning_path_steps')
        .select('id, step_order')
        .eq('path_id', createdPathId)
        .order('step_order', { ascending: true });
      expect(stepRowsError).toBeNull();
      expect(stepRows).toHaveLength(2);
      const firstStepId = stepRows![0]!.id;
      const secondStepId = stepRows![1]!.id;

      await card.getByTestId('learning-path-assign').click();
      await page.getByTestId('learning-path-assign-class').selectOption({
        label: 'Clasa Curajoșilor',
      });
      await page.getByTestId('learning-path-assign-due-date').fill('2026-06-01');
      await page.getByTestId('learning-path-assign-submit').click();

      await expect(page.getByRole('dialog')).toBeHidden({ timeout: 30000 });
      await gotoAppPage(page, `/teacher/paths/${createdPathId}`);
      await expect(page.getByTestId('learning-path-assignment-target')).toHaveText(
        'Clasa Curajoșilor',
      );

      await resetBrowserSession(page, '/login/elev');
      await loginPage.loginAsStudent(studentUsername, studentPin);
      await expect(page).toHaveURL(/\/student/, { timeout: 30000 });

      await gotoAppPage(page, '/student/map');
      await expect(page.getByText('Călătoria învățării')).toBeVisible({
        timeout: 30000,
      });
      await expect(page.getByText('Exersează numerele în doi pași.')).toBeVisible({
        timeout: 30000,
      });
      await expect(page.getByRole('link', { name: /etapa curentă/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /începe jocul/i })).toBeVisible();

      const progressTimestamp = new Date().toISOString();
      const { error: progressError } = await supabase
        .from('student_path_progress')
        .upsert(
          {
            student_id: studentId,
            path_id: createdPathId,
            current_step_id: secondStepId,
            last_completed_step_id: firstStepId,
            status: 'in_progress',
            started_at: progressTimestamp,
            completed_at: null,
            updated_at: progressTimestamp,
          },
          { onConflict: 'student_id,path_id' },
        );
      expect(progressError).toBeNull();

      await gotoAppPage(page, '/student/map');
      await expect(page.getByText('Al doilea joc')).toBeVisible({
        timeout: 30000,
      });

      await resetBrowserSession(page, '/login');
      await loginPage.loginAsTeacher(email, password);
      await expect(page).toHaveURL(/\/teacher/, { timeout: 30000 });

      await gotoAppPage(page, `/teacher/classes/${classId}/paths/${createdPathId}`);
      const row = page.getByTestId(`class-path-progress-row-${studentId}`);
      await expect(row).toContainText('Ana Parcurs', { timeout: 30000 });
      await expect(row).toContainText('În progres');
      await expect(row).toContainText('Primul joc');

      await row.getByRole('button', { name: /corectează/i }).click();
      await row.getByLabel(/acțiune pentru ana parcurs/i).selectOption('completed');
      await row
        .getByLabel(/confirm că vreau să corectez manual/i)
        .check();
      await row.getByRole('button', { name: /aplică modificarea/i }).click();
      await expect(row.getByRole('status')).toContainText(
        /progresul a fost actualizat/i,
        { timeout: 30000 },
      );
      await expect(row).toContainText(/finalizat|corectat manual/i, {
        timeout: 30000,
      });

      await gotoAppPage(page, `/teacher/paths/${createdPathId}`);
      await page.getByTestId('learning-path-unassign').click();
      await expect(page.getByTestId('learning-path-assignments')).toContainText(
        'Nu ai atribuit încă acest parcurs',
        { timeout: 30000 },
      );
    });
  });

  test.describe('route protection', () => {
    test('redirects unauthenticated users from learning-path pages', async ({
      page,
    }) => {
      for (const route of [
        '/teacher/paths',
        '/teacher/paths/new',
        '/teacher/paths/00000000-0000-4000-8000-000000000000',
      ]) {
        await page.goto(route);
        await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
      }
    });
  });
});
