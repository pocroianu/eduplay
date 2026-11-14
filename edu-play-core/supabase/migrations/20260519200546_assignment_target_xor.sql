-- Assignment target rows must be unambiguous and scoped to the teacher roster.
-- A selected-student assignment with class_id also set is visible to the whole
-- class through RLS, so enforce exactly one target at the database boundary.

UPDATE public.assignments
   SET class_id = NULL
 WHERE class_id IS NOT NULL
   AND student_id IS NOT NULL;

DELETE FROM public.assignments
 WHERE class_id IS NULL
   AND student_id IS NULL;

ALTER TABLE public.assignments
  DROP CONSTRAINT IF EXISTS assignments_class_id_student_id_check;

ALTER TABLE public.assignments
  DROP CONSTRAINT IF EXISTS assignments_check;

ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_exactly_one_target
  CHECK (num_nonnulls(class_id, student_id) = 1);

COMMENT ON CONSTRAINT assignments_exactly_one_target ON public.assignments IS
  'Assignments target either one class or one student, never both; selected-student assignments are represented as one row per student.';

CREATE OR REPLACE FUNCTION public.teacher_owns_assignment_target(
  p_teacher_id UUID,
  p_class_id UUID,
  p_student_id UUID
)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.profiles
     WHERE id = p_teacher_id
       AND role = 'teacher'
  )
  AND (
    (
      p_class_id IS NOT NULL
      AND p_student_id IS NULL
      AND EXISTS (
        SELECT 1
          FROM public.classes
         WHERE id = p_class_id
           AND teacher_id = p_teacher_id
      )
    )
    OR
    (
      p_class_id IS NULL
      AND p_student_id IS NOT NULL
      AND EXISTS (
        SELECT 1
          FROM public.students
          JOIN public.classes ON classes.id = students.class_id
         WHERE students.id = p_student_id
           AND classes.teacher_id = p_teacher_id
      )
    )
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE;

REVOKE ALL ON FUNCTION public.teacher_owns_assignment_target(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.teacher_owns_assignment_target(UUID, UUID, UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.teacher_owns_assignment_target(UUID, UUID, UUID) IS
  'Checks that an assignment target belongs to the teacher roster before RLS allows inserts or target-changing updates.';

DROP POLICY IF EXISTS "Teachers can manage assignments" ON public.assignments;
DROP POLICY IF EXISTS "Teachers can view own assignments" ON public.assignments;
DROP POLICY IF EXISTS "Teachers can insert own roster assignments" ON public.assignments;
DROP POLICY IF EXISTS "Teachers can update own roster assignments" ON public.assignments;
DROP POLICY IF EXISTS "Teachers can delete own assignments" ON public.assignments;

CREATE POLICY "Teachers can view own assignments" ON public.assignments
  FOR SELECT USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can insert own roster assignments" ON public.assignments
  FOR INSERT WITH CHECK (
    auth.uid() = teacher_id
    AND public.teacher_owns_assignment_target(teacher_id, class_id, student_id)
  );

CREATE POLICY "Teachers can update own roster assignments" ON public.assignments
  FOR UPDATE USING (auth.uid() = teacher_id)
  WITH CHECK (
    auth.uid() = teacher_id
    AND public.teacher_owns_assignment_target(teacher_id, class_id, student_id)
  );

CREATE POLICY "Teachers can delete own assignments" ON public.assignments
  FOR DELETE USING (auth.uid() = teacher_id);
