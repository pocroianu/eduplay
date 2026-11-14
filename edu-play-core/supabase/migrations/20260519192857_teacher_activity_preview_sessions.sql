-- Allow teacher-owned private Activity preview sessions without broadening public access.

DROP POLICY IF EXISTS "Admins manage own activity preview sessions" ON public.activity_preview_sessions;
DROP POLICY IF EXISTS "Admins and teachers manage own activity preview sessions" ON public.activity_preview_sessions;

CREATE POLICY "Admins and teachers manage own activity preview sessions"
  ON public.activity_preview_sessions FOR ALL
  USING (
    created_by = auth.uid()
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1
          FROM public.profiles p
          JOIN public.activities a ON a.id = activity_preview_sessions.activity_id
         WHERE p.id = auth.uid()
           AND p.role = 'teacher'
           AND a.created_by = auth.uid()
           AND a.visibility_scope = 'private'
      )
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1
          FROM public.profiles p
          JOIN public.activities a ON a.id = activity_preview_sessions.activity_id
         WHERE p.id = auth.uid()
           AND p.role = 'teacher'
           AND a.created_by = auth.uid()
           AND a.visibility_scope = 'private'
      )
    )
  );

COMMENT ON POLICY "Admins and teachers manage own activity preview sessions" ON public.activity_preview_sessions IS
  'Preview sessions are opaque, actor-owned rows. Admins can manage own rows; teachers can manage only their own sessions for their own private Activities.';
