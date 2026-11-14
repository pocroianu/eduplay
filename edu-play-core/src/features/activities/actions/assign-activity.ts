'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { ROUTES } from '@/shared/lib/constants/routes';
import { getActivityType } from '../registry';
import type { ActionResult } from '../types';
import '../types/registrations';

const uuid = z.string().uuid('ID invalid');

const assignActivitySchema = z
  .object({
    activityTypeId: z
      .string()
      .min(1, 'Alege tipul activității')
      .max(80, 'Tipul activității este prea lung'),
    config: z.unknown().default({}),
    classId: uuid.optional(),
    studentIds: z.array(uuid).min(1, 'Alege cel puțin un elev').optional(),
  })
  .refine(
    (data) => Boolean(data.classId) !== Boolean(data.studentIds?.length),
    {
      message: 'Alege o clasă sau unul ori mai mulți elevi.',
      path: ['classId'],
    },
  );

export type AssignActivityInput = z.input<typeof assignActivitySchema>;

export interface AssignActivityData {
  instanceIds: string[];
}

interface StudentTarget {
  id: string;
  class_id: string | null;
}

interface TeacherContext {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
}

export async function assignActivity(
  input: unknown,
): Promise<ActionResult<AssignActivityData>> {
  const parsed = assignActivitySchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Date invalide',
    };
  }

  const definition = getActivityType(parsed.data.activityTypeId);
  if (!definition) {
    return {
      success: false,
      error: 'Tipul de activitate nu este disponibil.',
    };
  }

  const config = definition.configSchema.safeParse(parsed.data.config);
  if (!config.success) {
    return {
      success: false,
      error: 'Configurația activității nu este validă.',
    };
  }

  const auth = await getTeacherContext();
  if (!auth) {
    return {
      success: false,
      error: 'Nu ești autentificat ca profesor.',
    };
  }

  const targets = parsed.data.classId
    ? await getClassTargets(auth, parsed.data.classId)
    : await getStudentTargets(auth, parsed.data.studentIds ?? []);

  if (!targets.success || !targets.data) {
    return {
      success: false,
      error: targets.error ?? 'Nu am putut pregăti lista de elevi.',
    };
  }
  if (targets.data.students.length === 0) {
    return {
      success: false,
      error: 'Nu există elevi pentru această atribuire.',
    };
  }

  const rows = targets.data.students.map((student) => ({
    type_id: parsed.data.activityTypeId,
    config: config.data,
    assigned_to: student.id,
    class_id: student.class_id,
    created_by: auth.userId,
  }));

  const { data, error } = await auth.supabase
    .from('activity_instances')
    .insert(rows)
    .select('id');

  if (error || !data) {
    return {
      success: false,
      error: 'Nu am putut atribui activitatea. Încearcă din nou.',
    };
  }

  revalidatePath(ROUTES.TEACHER.ASSIGNMENTS);
  revalidatePath(ROUTES.TEACHER.DASHBOARD);
  for (const classId of targets.data.classIds) {
    revalidatePath(ROUTES.TEACHER.CLASS(classId));
  }
  revalidatePath(ROUTES.STUDENT.DASHBOARD);

  return {
    success: true,
    data: {
      instanceIds: (data as Array<{ id: string }>).map((row) => row.id),
    },
  };
}

async function getTeacherContext(): Promise<TeacherContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'teacher') return null;

  return { supabase, userId: user.id };
}

async function getClassTargets(
  ctx: TeacherContext,
  classId: string,
): Promise<ActionResult<{ students: StudentTarget[]; classIds: string[] }>> {
  const { data: ownedClass, error: classError } = await ctx.supabase
    .from('classes')
    .select('id')
    .eq('id', classId)
    .eq('teacher_id', ctx.userId)
    .maybeSingle();

  if (classError || !ownedClass) {
    return {
      success: false,
      error: 'Clasa nu a fost găsită sau nu îți aparține.',
    };
  }

  const { data: students, error: studentsError } = await ctx.supabase
    .from('students')
    .select('id, class_id')
    .eq('class_id', classId)
    .order('display_name');

  if (studentsError) {
    return {
      success: false,
      error: 'Nu am putut încărca elevii clasei.',
    };
  }

  return {
    success: true,
    data: {
      students: (students ?? []) as StudentTarget[],
      classIds: [classId],
    },
  };
}

async function getStudentTargets(
  ctx: TeacherContext,
  studentIds: string[],
): Promise<ActionResult<{ students: StudentTarget[]; classIds: string[] }>> {
  const uniqueStudentIds = Array.from(new Set(studentIds));
  const { data: students, error: studentsError } = await ctx.supabase
    .from('students')
    .select('id, class_id')
    .in('id', uniqueStudentIds);

  if (studentsError) {
    return {
      success: false,
      error: 'Nu am putut încărca elevii selectați.',
    };
  }

  const rows = (students ?? []) as StudentTarget[];
  if (rows.length !== uniqueStudentIds.length) {
    return {
      success: false,
      error: 'Unul dintre elevii selectați nu a fost găsit.',
    };
  }

  const classIds = Array.from(
    new Set(rows.map((student) => student.class_id).filter(Boolean)),
  ) as string[];
  if (classIds.length === 0) {
    return {
      success: false,
      error: 'Poți atribui activități doar elevilor din clasele tale.',
    };
  }

  const { data: ownedClasses, error: classesError } = await ctx.supabase
    .from('classes')
    .select('id')
    .eq('teacher_id', ctx.userId)
    .in('id', classIds);

  if (classesError) {
    return {
      success: false,
      error: 'Nu am putut verifica clasele elevilor.',
    };
  }

  const ownedClassIds = new Set(
    ((ownedClasses ?? []) as Array<{ id: string }>).map((row) => row.id),
  );
  if (
    rows.some(
      (student) => !student.class_id || !ownedClassIds.has(student.class_id),
    )
  ) {
    return {
      success: false,
      error: 'Poți atribui activități doar elevilor din clasele tale.',
    };
  }

  return {
    success: true,
    data: {
      students: rows,
      classIds,
    },
  };
}
